# 32-computer-use-platform-components — 平台化组件选择（链位 32，32-computer-use-platform-components.patch）

> 功能组：pr-8 — Computer Use 解锁 Linux(X11) + 连接器目录 Linux 平台支持（pr-prepare/pr-8/）
> 链位 32，patch `32-computer-use-platform-components.patch`（本目录）

- 需求背景：用户指示「应该自动根据 windows/macos/linux 平台不同，所需组件不同」。核查发现依赖清单本身早已分档且正确（win: pywin32/screeninfo；linux: python-xlib，与各自 helper import 逐项对得上），服务端/前端也按 engine 分流——「缺分档」不是问题，**选择方式有洞**：`pythonBridge.ts` 用二元三目 `isLinux ? 'requirements-linux.txt' : 'requirements-win.txt'`，macOS（或任何未知平台）会落到 Windows 那份（把 pywin32 装给 mac），正常路径只是靠上游 engine 守卫挡住。
- 方案：抽出显式平台表 `pythonRuntimeFor(platform)`：win32→win 组件、linux→linux 组件、其余（含 darwin）→`null`（无 Python 组件）；`ensureRuntimeFiles` 走该表（null 时不再同步 requirements）；`ensureBootstrapped` 在无组件集时响亮拒绝而非装错平台的包；`bootstrapPipIntoVenv` 补救提示按平台给（Windows 提示官方安装器/ensurepip，其余提示装系统 venv 包），不再对着 Windows 用户喊 `apt install python3-venv`。
- 验证：`pipInstall.test.ts` 新增 `pythonRuntimeFor` 两用例（各平台映射 + darwin/未知→null）与 Windows 补救用例；linux 补救既有用例改为显式传 platform（原先依赖运行平台，在 Windows CI 会假失败）；合并跑 15/15 通过，改动文件 tsc 0 报错。
