# h5-access-token — H5 访问令牌开关 + 免令牌豁免（原链位 1,2,5）

> 功能主题：`h5` — H5 远程访问与移动端支持（`pr-prepare/h5/`）｜ PR 分支 `h5-remote-access`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/h5/h5-access-token-patch1.patch`（34 文件 +2480−144）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 1 | `h5-require-token` | 一 H5 令牌开关 + 免令牌豁免 |
| 2 | `h5-auto-mode-optin` | 一 H5 选「自动模式」400 修复（1.1） |
| 5 | `h5-terminal-bridge` | 一 H5 终端桥接（1.2） |

## 明细

### 原链位 1 — `h5-require-token`

- 需求背景：0.5.3 旧实现有 H5 令牌开关与私网豁免，0.6.6 基座无 `requireToken` 字段（`normalizeStoredSettings` 静默丢弃），且私网来源（LAN IP 浏览器）不被豁免、桌面前端 `requiresH5AuthForServerUrl` 只豁免 loopback，导致 LAN 手机打开 H5 仍弹 token 输入。与用户确认最终语义：默认 `requireToken: false` = 全免 token；开启时 loopback + RFC1918 + IPv6 ULA（fc00::/7）按 socket 源地址（`server.requestIP()`）免 token，公网需 Bearer token。
- 方案：
  - `h5AccessService.ts` 加 `requireToken: boolean`（默认 false，`=== true` 解析）；`api/h5-access.ts` PUT 透传。
  - `h5AccessPolicy.ts` 新增 `isPrivateIPv4Source` 与 `isTrustedLocalSourceHost`（剥 bracket/`::ffff:` 前缀 → loopback → ULA 正则 → 私网 IPv4），`shouldRequireH5Token` 加必填 `requireToken` 参数。
  - 桌面端 `desktopRuntime.ts` 加 tokenless 快速路径：health 后先探 `/api/status`，仅 401(missing-token) 才落 token 输入流程。
  - `H5AccessSettings.tsx` enabled 行下新增 checkbox，即时生效（非 draft/save）；i18n 5 语言各 2 key；settingsStore/api/types 同步加字段。
- 验证：服务端 h5-access-policy 31/31 + h5-access-service 28/28；桌面 generalSettings 131、settingsStore 64、desktopRuntime 30/30（含 LAN 免 token 直连新用例）；dev 7788 live 在 LAN/loopback/模拟公网 XFF 下按 requireToken 两种取值全部符合预期，控制面 PUT 落盘正确。真实设备回归：192.168.10.140 手机免 token 直连成功（此前失败根因是 dist bundle 过期）。

### 原链位 2 — `h5-auto-mode-optin`

- 需求背景：H5（手机浏览器）权限审批选「自动模式」点确认后 toast 持续报 400。根因：`acceptAutoModeOptIn()` 走 `PUT /api/settings/user {skipAutoPermissionPrompt:true}`，H5 请求被分类为 `h5-browser` 后走 `validateRemoteSettingsPatch` 白名单校验，而 `WRITE_SETTINGS` 白名单 5 个字段不含 `skipAutoPermissionPrompt`（只读不可写）→ 400 `Unsupported General setting`；桌面端 local-trusted 不走此校验故仅 H5 报错。
- 方案：`src/server/remoteBrowserPolicy.ts` 的 `WRITE_SETTINGS` 白名单加入 `skipAutoPermissionPrompt`（boolean，复用既有 `typeof value === 'boolean'` 末行校验），风险等级与其它白名单布尔字段一致。
- 验证：`router.remoteBrowser.test.ts` 合法 patch 用例加该字段并补「单独 PUT 200+落盘」「字符串 `'true'` 仍 400」断言，8/8 pass；dev 7788 live（LAN 视角）修复前 400 → 修复后 200 且 GET 读回落盘正确。

### 原链位 5 — `h5-terminal-bridge`

- 需求背景：终端能力原本桌面独占（`browserHost.capabilities.terminal=false`，浏览器端只显示「unavailable」空态）。目标：H5 手机浏览器也能起真实 PTY 终端，默认工作目录跟随当前会话 workDir，功能对齐（shell 选择 + bash 路径设置）。
- 方案：
  - 服务端新增 `terminalService.ts`（~836 行，镜像 electron 侧 shell/cwd/env/事件逻辑，注入 `ptyFactory`，15s 断连宽限、`/api/terminal/bash-path` REST）；WS 通道 `handler.ts` 扩 `'terminal'` channel（`terminal_spawn/write/resize/kill` ↔ `terminal_spawned/output/exited/sync`）；`index.ts` 在 `/ws/` 之前插 `/ws/terminal` 字面路由；`remoteBrowserPolicy.ts` 放行 `desktopTerminal` 设置键。
  - 前端新增 `terminalWs.ts`（独立 WS 客户端，指数退避重连）；`browserHost.ts` capabilities.terminal 改 true 并改 WS 实现；`H5Settings.tsx` 渲染 `<H5TerminalSettings/>`（cwd 取 `activeSession?.workDir ?? projectRoot`）；xterm 层 `TerminalSettings.tsx` 零改动。
  - 关键 Bug 修复：Bun 下 node-pty 的 `tty.ReadStream` 首次 EAGAIN 即关流致 PTY ~12ms SIGHUP 秒退 → 绕过 UnixTerminal 直接调原生 `pty.fork`，master fd 用异步 `fs.read` 非阻塞读；另修 `stopSession` 竞态（先删 map 致 exit 帧丢失）。
  - Bug 2：LAN IP 是非安全上下文，`crypto.randomUUID` undefined 致开终端报错 → 加 `createTerminalRequestId()` 回退 id 生成。
- 验证：`terminal-service.test.ts` 11/11（FakePty 注入）、`websocket-handler.test.ts` 103/103；前端 `tsc -b` 0 错、vitest terminal+contract 12/12；dev 7788 live（LAN 带 H5 token）spawn→echo→resize→kill→`terminal_exited` 帧全链路通过；5 patch 全链 `git apply` 干净且与当时工作树逐字节一致。
