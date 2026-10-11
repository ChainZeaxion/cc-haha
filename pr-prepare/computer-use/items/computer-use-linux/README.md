# computer-use-linux — Computer Use 解锁 Linux(X11)（原链位 18,32,33）

> 功能主题：`computer-use` — Computer Use 解锁 Linux(X11) + 连接器平台（`pr-prepare/computer-use/`）｜ PR 分支 `computer-use-linux`
> **单一真相源 patch**：`modify/patches/computer-use/computer-use-linux-patch1.patch`（31 文件 +1473−81）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 18 | `computer-use-linux-x11` | 十八 Computer Use 解锁 Linux（X11） |
| 32 | `computer-use-platform-components` | 十八 平台化组件选择：`pythonRuntimeFor()` 显式平台表（macOS/未知平台无 Python 组件），修复「二元三目」把 win 依赖清单发给 mac |
| 33 | `computer-use-python-path-fallback` | 十八 无原生文件选择器时**回退填入已探测解释器路径**（+ 5 语言 i18n 键 + 测试） |

## 明细

### 原链位 18 — `computer-use-linux-x11`

- 需求背景：Computer Use 此前仅对 macOS/Windows 开放，Linux 上设置页/会话侧看不到入口、MCP 工具不暴露。0.6.6 平台判定分散内联在约 9 处生产代码的 `'darwin'|'win32'` 联合类型中；核心路由缝 `helperBridge.ts` 的 else 分支（现仅 win32）走 `callPythonHelper`，Linux 天然落入 Python 路线，无需新通道。
- 方案：
  - 批次 A（门控放宽+状态页，24 文件 +1231/−75）：`isComputerUseSupportedPlatform`/`shouldExposeComputerUseMcp`/`skillGate` 补 linux；`resolveComputerUseCapability` 加 linux→`{supported:true, engine:'linux-x11'}`；9 处内联联合类型逐一补 `'linux'`；`mcpServer.ts` 像素面选择改 `win32 || linux`（Linux 路由到 legacy pixel 工具集）；`PYTHON_DOWNLOAD_URLS` 与 `ComputerUseEnableDialog` platform prop 补 linux。另修 3 处实施中发现的 linux 误路由（`ensureRuntimeFiles` 按平台选 helper 内容、剪贴板 `platform!=='darwin'?callHelper:pb`、windowsLegacyToolCalls 剪贴板/单进程 type 条件改 `!=='darwin'`）。
  - 批次 B（Linux 像素 helper，2 新文件）：`runtime/linux_helper.py`（986 行，镜像 win_helper 全 26 命令面；mss 截图/pyautogui 输入/python-xlib X11 窗口枚举/前台化/XDG 应用枚举）+ `runtime/requirements-linux.txt`（mss/Pillow/pyautogui/python-xlib/psutil/pyperclip）；`pythonBridge.ts` 按平台选 helper/requirements。
  - X11 实机冒烟暴露 5 处 python-xlib API 坑全修（get_property 4 参、`disp.get_atom` 取代 `intern_atom`、frontmost 优先 `_NET_ACTIVE_WINDOW`、GTK 窗 WM_CLASS 兜底、`moveTo(duration=)` 签名）。
- 验证：computer-use 全族 bun test 24 fail = 干净基线 24 fail（worktree@HEAD 对照法），零新增回归，各测试文件新增 linux 用例；前端 ComputerUseSettings 族 26/26 绿、全量 desktop vitest 12454 pass 零新增回归；live 7788 `GET /api/computer-use/status` 回 `{platform:"linux", supported:true, engine:"linux-x11"}`；X11 实机（GNOME）全 26 命令面冒烟通过（screenshot/点击/键入/滚动/frontmost/list_running_apps 112 条等）。

### 原链位 32 — `computer-use-platform-components`

- 需求背景：用户指示「应该自动根据 windows/macos/linux 平台不同，所需组件不同」。核查发现依赖清单本身早已分档且正确（win: pywin32/screeninfo；linux: python-xlib，与各自 helper import 逐项对得上），服务端/前端也按 engine 分流——「缺分档」不是问题，**选择方式有洞**：`pythonBridge.ts` 用二元三目 `isLinux ? 'requirements-linux.txt' : 'requirements-win.txt'`，macOS（或任何未知平台）会落到 Windows 那份（把 pywin32 装给 mac），正常路径只是靠上游 engine 守卫挡住。
- 方案：抽出显式平台表 `pythonRuntimeFor(platform)`：win32→win 组件、linux→linux 组件、其余（含 darwin）→`null`（无 Python 组件）；`ensureRuntimeFiles` 走该表（null 时不再同步 requirements）；`ensureBootstrapped` 在无组件集时响亮拒绝而非装错平台的包；`bootstrapPipIntoVenv` 补救提示按平台给（Windows 提示官方安装器/ensurepip，其余提示装系统 venv 包），不再对着 Windows 用户喊 `apt install python3-venv`。
- 验证：`pipInstall.test.ts` 新增 `pythonRuntimeFor` 两用例（各平台映射 + darwin/未知→null）与 Windows 补救用例；linux 补救既有用例改为显式传 platform（原先依赖运行平台，在 Windows CI 会假失败）；合并跑 15/15 通过，改动文件 tsc 0 报错。

### 原链位 33 — `computer-use-python-path-fallback`

- 需求背景：解释器路径输入框点「浏览」在两种情形下拿不到选择器——H5/浏览器下原生文件选择器选的是浏览器所在机器的文件（解释器在跑 sidecar 的机器上，永远选不中）；Linux 无 portal 时原生对话框也可能直接失败。原实现两种情形都只留下一个空输入框让用户手抄路径。
- 方案：失败即回退——`fallbackToDetectedPythonPath()`（`ComputerUseSettings.tsx`）把服务端已探测到的解释器路径填入草稿并提示确认保存；新增 i18n 键 `settings.computerUse.pythonPathDialogDetected`（en/zh/jp/kr/zh-TW 五语言各 +1）。
- 验证：`ComputerUseSettings` 族测试（含新增用例）通过；五语言键对齐。
