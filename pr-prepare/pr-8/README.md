# pr-8 — Computer Use 解锁 Linux(X11) + 连接器目录 Linux 平台支持

## 功能域概述

本组让 cc-haha 在 Linux 平台上补全两块平台能力：一是把 Computer Use（电脑操作）从 macOS/Windows 扩展到 **Linux（X11 桌面）**，走 Windows 同款的像素面兼容路线（screenshot/点击/键入/滚动等 legacy pixel 工具 + Python helper），并修复组件选择与解释器路径填写在 Linux/H5 场景下的两类洞；二是让**连接器目录（飞书/钉钉/企微等）声明并可用 Linux（x64/arm64）**，使 Linux 桌面与 H5/服务端场景的连接器卡片不再显示「当前平台不支持」。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. 连接器目录 Linux 平台支持（链位 16，16-connector-linux-platform.patch）

- 需求背景：移动端 H5 市场页连接器卡片全显示「当前平台不支持」。`supported` 由服务端按 `platforms.includes(process.platform-process.arch)` 判定，旧目录只声明 darwin/win32，Linux（本机 linux-x64）全部被判不支持。CLI 三连接器（feishu/dingtalk/wecom）还走 `managedRuntime.prepareManagedRuntime`，按平台 pin 下载 URL + sha256/sha512 哈希，且 `os` 映射把 Linux 误当成 darwin URL。
- 方案：
  - `catalog.ts`/`skillCatalog.ts`/`remoteCatalog.ts`：feishu/dingtalk/wecom `platforms` 加 `linux-x64`、`linux-arm64`（skill/remote 平台无关，保守统一声明）。
  - `managedRuntime.ts`（核心）：lark/wecom 归档哈希表 + 三连接器 `initialBinaryHashes` 各补 linux-x64/linux-arm64 pin（URL 均实测可达，dingtalk 归档 sha512 复用同一 tgz，实测与既有 pin 逐字节一致）；修 `os` 映射，Linux 走 `-linux-amd64/arm64` 产物。
  - legacy 版本回退正则 `[a-z]+-(?:arm64|x64)$` 本就通用，linux 目录名可解析，无需改。
- 验证：6 个 Linux pin 全解析（不再抛 "no pinned artifact"）；live 7788 端到端 `prepare` 下载 14MB 归档→sha256 双校验→`lark-cli --version` 实际可执行；`bun test src/services/connectors/` 416 pass / 0 fail（加 linux 平台后顺带修好 8 条既有平台耦合失败）；H5 市场卡片「当前平台不支持」→「待连接账号」。

### 2. Computer Use 解锁 Linux（X11）（链位 18，18-computer-use-linux-x11.patch）

- 需求背景：Computer Use 此前仅对 macOS/Windows 开放，Linux 上设置页/会话侧看不到入口、MCP 工具不暴露。0.6.6 平台判定分散内联在约 9 处生产代码的 `'darwin'|'win32'` 联合类型中；核心路由缝 `helperBridge.ts` 的 else 分支（现仅 win32）走 `callPythonHelper`，Linux 天然落入 Python 路线，无需新通道。
- 方案：
  - 批次 A（门控放宽+状态页，24 文件 +1231/−75）：`isComputerUseSupportedPlatform`/`shouldExposeComputerUseMcp`/`skillGate` 补 linux；`resolveComputerUseCapability` 加 linux→`{supported:true, engine:'linux-x11'}`；9 处内联联合类型逐一补 `'linux'`；`mcpServer.ts` 像素面选择改 `win32 || linux`（Linux 路由到 legacy pixel 工具集）；`PYTHON_DOWNLOAD_URLS` 与 `ComputerUseEnableDialog` platform prop 补 linux。另修 3 处实施中发现的 linux 误路由（`ensureRuntimeFiles` 按平台选 helper 内容、剪贴板 `platform!=='darwin'?callHelper:pb`、windowsLegacyToolCalls 剪贴板/单进程 type 条件改 `!=='darwin'`）。
  - 批次 B（Linux 像素 helper，2 新文件）：`runtime/linux_helper.py`（986 行，镜像 win_helper 全 26 命令面；mss 截图/pyautogui 输入/python-xlib X11 窗口枚举/前台化/XDG 应用枚举）+ `runtime/requirements-linux.txt`（mss/Pillow/pyautogui/python-xlib/psutil/pyperclip）；`pythonBridge.ts` 按平台选 helper/requirements。
  - X11 实机冒烟暴露 5 处 python-xlib API 坑全修（get_property 4 参、`disp.get_atom` 取代 `intern_atom`、frontmost 优先 `_NET_ACTIVE_WINDOW`、GTK 窗 WM_CLASS 兜底、`moveTo(duration=)` 签名）。
- 验证：computer-use 全族 bun test 24 fail = 干净基线 24 fail（worktree@HEAD 对照法），零新增回归，各测试文件新增 linux 用例；前端 ComputerUseSettings 族 26/26 绿、全量 desktop vitest 12454 pass 零新增回归；live 7788 `GET /api/computer-use/status` 回 `{platform:"linux", supported:true, engine:"linux-x11"}`；X11 实机（GNOME）全 26 命令面冒烟通过（screenshot/点击/键入/滚动/frontmost/list_running_apps 112 条等）。

### 3. 平台化组件选择（链位 32，32-computer-use-platform-components.patch）

- 需求背景：用户指示「应该自动根据 windows/macos/linux 平台不同，所需组件不同」。核查发现依赖清单本身早已分档且正确（win: pywin32/screeninfo；linux: python-xlib，与各自 helper import 逐项对得上），服务端/前端也按 engine 分流——「缺分档」不是问题，**选择方式有洞**：`pythonBridge.ts` 用二元三目 `isLinux ? 'requirements-linux.txt' : 'requirements-win.txt'`，macOS（或任何未知平台）会落到 Windows 那份（把 pywin32 装给 mac），正常路径只是靠上游 engine 守卫挡住。
- 方案：抽出显式平台表 `pythonRuntimeFor(platform)`：win32→win 组件、linux→linux 组件、其余（含 darwin）→`null`（无 Python 组件）；`ensureRuntimeFiles` 走该表（null 时不再同步 requirements）；`ensureBootstrapped` 在无组件集时响亮拒绝而非装错平台的包；`bootstrapPipIntoVenv` 补救提示按平台给（Windows 提示官方安装器/ensurepip，其余提示装系统 venv 包），不再对着 Windows 用户喊 `apt install python3-venv`。
- 验证：`pipInstall.test.ts` 新增 `pythonRuntimeFor` 两用例（各平台映射 + darwin/未知→null）与 Windows 补救用例；linux 补救既有用例改为显式传 platform（原先依赖运行平台，在 Windows CI 会假失败）；合并跑 15/15 通过，改动文件 tsc 0 报错。

### 4. 无原生文件选择器时回退填入已探测路径（链位 33，33-computer-use-python-path-fallback.patch）

- 需求背景：解释器路径输入框点「浏览」在两种情形下拿不到选择器——H5/浏览器下原生文件选择器选的是浏览器所在机器的文件（解释器在跑 sidecar 的机器上，永远选不中）；Linux 无 portal 时原生对话框也可能直接失败。原实现两种情形都只留下一个空输入框让用户手抄路径。
- 方案：失败即回退——`fallbackToDetectedPythonPath()`（`ComputerUseSettings.tsx`）把服务端已探测到的解释器路径填入草稿并提示确认保存；新增 i18n 键 `settings.computerUse.pythonPathDialogDetected`（en/zh/jp/kr/zh-TW 五语言各 +1）。
- 验证：`ComputerUseSettings` 族测试（含新增用例）通过；五语言键对齐。

## 验证口径（组级）

- 单测以「git worktree@HEAD 对照法」判回归：失败集合与干净基线逐条对照，零新增回归即可（基线本身存在 mac 专属 helperBridge/cu-helper 快照族失败，与 Linux 改动无关）。
- 前端以全量 desktop vitest 对齐基线（12454 pass / 4 fail 孪生环境项）+ `tsc --noEmit` exit 0。
- live 验证走 dev sidecar 7788：Computer Use 以 `GET /api/computer-use/status` 的 `engine:'linux-x11'` + 设置页进入 Python 安装流为准；连接器以端到端 `POST /api/connectors/<name>/prepare` 双哈希校验 + 二进制 `--version` 可执行为准；H5 移动端市场卡片文案变化为准。
- X11 实机冒烟（可选但推荐）：GNOME 桌面 + `/tmp` 临时 venv 装全 6 依赖，26 命令面逐一过一遍。

## 与其他组的关系（简述）

- 本组文件清单中的传递依赖（`h5Access.ts`、`browserHost.ts`、`terminalWs.ts`、`settingsStore.ts`、`settings.ts`）由链内其他组的改动带来，合并上游 PR 时需确认这些依赖已先行合入或以最小 diff 方式处理。
- 与 H5/移动端体验类组（连接器市场卡片展示、Computer Use 设置页可达性）在用户可见层面耦合：本组修好后，移动端「市场」与 Computer Use 入口在 Linux 宿主机上才真正可用。
- 子优化③④（链位 32/33）建立在链位 18 的 Linux 解锁之上（engine 分流、Python 安装流），上游 PR 内 4 个 patch 须按链位顺序 apply，不可颠倒。

## 风险与备注

- ⚠️ 上游冲突风险文件（上游 main 也改过）：
  - `desktop/src/i18n/locales/{en,jp,kr,zh-TW,zh}.ts` — 本组新增 1 个 i18n 键，五语言文件均高频变动，合并时几乎必然需要 rebase/手工解冲突。
  - `src/services/connectors/skillCatalog.ts` — 连接器目录文件上游有独立演进。
  - `src/vendor/computer-use-mcp/windowsLegacyToolCalls.ts` — vendor 目录上游若同步 Computer Use 改动会直接撞 hunk。
- Linux 系统依赖需写进部署文档：X11 桌面必须；剪贴板 write 需 `xclip` 或 `xsel` 之一；XWayland 下部分 pyautogui/窗口状态能力受限（guards fail open），状态页建议给提示。
- 测试基线的 24 条既有失败是 mac 专属 daemon 路径（helperBridge/cu-helper 快照族），向上游提 PR 时若上游在 mac 环境跑，需说明或剥离这批环境性失败。
- `runtime/linux_helper.py` 为 986 行新文件 + `requirements-linux.txt` 新文件，属纯增量，冲突风险低；主要体积集中在 24 文件（+1231/−75）的链位 18 patch，review 时可按批次 A/B 分段看。
