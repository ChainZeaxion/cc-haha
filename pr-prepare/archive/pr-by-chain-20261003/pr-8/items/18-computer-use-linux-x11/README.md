# 18-computer-use-linux-x11 — Computer Use 解锁 Linux（X11）（链位 18，18-computer-use-linux-x11.patch）

> 功能组：pr-8 — Computer Use 解锁 Linux(X11) + 连接器目录 Linux 平台支持（pr-prepare/pr-8/）
> 链位 18，patch `18-computer-use-linux-x11.patch`（本目录）

- 需求背景：Computer Use 此前仅对 macOS/Windows 开放，Linux 上设置页/会话侧看不到入口、MCP 工具不暴露。0.6.6 平台判定分散内联在约 9 处生产代码的 `'darwin'|'win32'` 联合类型中；核心路由缝 `helperBridge.ts` 的 else 分支（现仅 win32）走 `callPythonHelper`，Linux 天然落入 Python 路线，无需新通道。
- 方案：
  - 批次 A（门控放宽+状态页，24 文件 +1231/−75）：`isComputerUseSupportedPlatform`/`shouldExposeComputerUseMcp`/`skillGate` 补 linux；`resolveComputerUseCapability` 加 linux→`{supported:true, engine:'linux-x11'}`；9 处内联联合类型逐一补 `'linux'`；`mcpServer.ts` 像素面选择改 `win32 || linux`（Linux 路由到 legacy pixel 工具集）；`PYTHON_DOWNLOAD_URLS` 与 `ComputerUseEnableDialog` platform prop 补 linux。另修 3 处实施中发现的 linux 误路由（`ensureRuntimeFiles` 按平台选 helper 内容、剪贴板 `platform!=='darwin'?callHelper:pb`、windowsLegacyToolCalls 剪贴板/单进程 type 条件改 `!=='darwin'`）。
  - 批次 B（Linux 像素 helper，2 新文件）：`runtime/linux_helper.py`（986 行，镜像 win_helper 全 26 命令面；mss 截图/pyautogui 输入/python-xlib X11 窗口枚举/前台化/XDG 应用枚举）+ `runtime/requirements-linux.txt`（mss/Pillow/pyautogui/python-xlib/psutil/pyperclip）；`pythonBridge.ts` 按平台选 helper/requirements。
  - X11 实机冒烟暴露 5 处 python-xlib API 坑全修（get_property 4 参、`disp.get_atom` 取代 `intern_atom`、frontmost 优先 `_NET_ACTIVE_WINDOW`、GTK 窗 WM_CLASS 兜底、`moveTo(duration=)` 签名）。
- 验证：computer-use 全族 bun test 24 fail = 干净基线 24 fail（worktree@HEAD 对照法），零新增回归，各测试文件新增 linux 用例；前端 ComputerUseSettings 族 26/26 绿、全量 desktop vitest 12454 pass 零新增回归；live 7788 `GET /api/computer-use/status` 回 `{platform:"linux", supported:true, engine:"linux-x11"}`；X11 实机（GNOME）全 26 命令面冒烟通过（screenshot/点击/键入/滚动/frontmost/list_running_apps 112 条等）。
