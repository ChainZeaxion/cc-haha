# 05-h5-terminal-bridge — H5 终端桥接：手机浏览器用真实 PTY 终端（链位 5，`05-h5-terminal-bridge.patch`，对应文档 1.2）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 5，patch `05-h5-terminal-bridge.patch`（本目录）

- 需求背景：终端能力原本桌面独占（`browserHost.capabilities.terminal=false`，浏览器端只显示「unavailable」空态）。目标：H5 手机浏览器也能起真实 PTY 终端，默认工作目录跟随当前会话 workDir，功能对齐（shell 选择 + bash 路径设置）。
- 方案：
  - 服务端新增 `terminalService.ts`（~836 行，镜像 electron 侧 shell/cwd/env/事件逻辑，注入 `ptyFactory`，15s 断连宽限、`/api/terminal/bash-path` REST）；WS 通道 `handler.ts` 扩 `'terminal'` channel（`terminal_spawn/write/resize/kill` ↔ `terminal_spawned/output/exited/sync`）；`index.ts` 在 `/ws/` 之前插 `/ws/terminal` 字面路由；`remoteBrowserPolicy.ts` 放行 `desktopTerminal` 设置键。
  - 前端新增 `terminalWs.ts`（独立 WS 客户端，指数退避重连）；`browserHost.ts` capabilities.terminal 改 true 并改 WS 实现；`H5Settings.tsx` 渲染 `<H5TerminalSettings/>`（cwd 取 `activeSession?.workDir ?? projectRoot`）；xterm 层 `TerminalSettings.tsx` 零改动。
  - 关键 Bug 修复：Bun 下 node-pty 的 `tty.ReadStream` 首次 EAGAIN 即关流致 PTY ~12ms SIGHUP 秒退 → 绕过 UnixTerminal 直接调原生 `pty.fork`，master fd 用异步 `fs.read` 非阻塞读；另修 `stopSession` 竞态（先删 map 致 exit 帧丢失）。
  - Bug 2：LAN IP 是非安全上下文，`crypto.randomUUID` undefined 致开终端报错 → 加 `createTerminalRequestId()` 回退 id 生成。
- 验证：`terminal-service.test.ts` 11/11（FakePty 注入）、`websocket-handler.test.ts` 103/103；前端 `tsc -b` 0 错、vitest terminal+contract 12/12；dev 7788 live（LAN 带 H5 token）spawn→echo→resize→kill→`terminal_exited` 帧全链路通过；5 patch 全链 `git apply` 干净且与当时工作树逐字节一致。
