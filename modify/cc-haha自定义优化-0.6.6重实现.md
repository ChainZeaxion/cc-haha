# cc-haha 自定义优化（0.6.6 基座重实现）

> 本文件以 v0.6.6（2f8d819d，本仓库）为基座，重实现旧基座（v0.5.3，`/home/zeaxion/myproject/CC-HAHA-Scode` 分支 `perf/transcript-chunked-recovery`）上已验证的优化项。
> 需求权威源：`CC-HAHA-Scode/cc-haha自定义优化.md`（下文「源章节」均指该文件）。
> 状态图例：⬜待实施 · 🕓待实施/规划 · 🔍调研 · ✅已实施
> 当前为**骨架版**：仅保留章节结构与标题，实施时逐节填充（问题背景 / 0.6.6 现状核对 / 实施方案 / 验证）。
> **备注：旧优化文档的内容、逻辑、实现原理仅作为参考，具体在新代码（0.6.6 基座）上落地需量身定制**——组件名、挂载点、store/API、i18n key 等一律以 0.6.6 实际代码现状为准，逐章先核对再实施，不做整块照搬。

## 📇 分类目录（按优化项归类）

| 主题 | 章节 | 源章节 | 状态 |
|------|------|--------|------|
| 功能特性 | 一 H5 访问「需要访问令牌」开关 + 免令牌豁免 | 旧§二 | ✅ |
| 功能特性 | 二 会话导出（md/html/txt + 压缩边界范围） | 旧§三 | ✅ |
| 工具调用/协议 | 三 会话刷新按钮（卡住软刷新规避） | 旧§八 | ✅ |
| 功能特性 | 四 实时解码速度（TPS）指示器 + 手机端两行 | 旧§九/§十六 | ✅ |
| 功能特性 | 五 文件下载桥接 | 旧§十二 | ✅ |
| 功能特性 | 六 设置-关于-更新：禁止更新开关 | 旧§十三 | ✅ |
| 计费/上下文 | 七 上下文缓存与计费显示（cache 命中率修正） | 旧§十四 | ✅ |
| 功能特性 | 八 思考模式二级开关（think 是否回传后端） | 旧§二十五 | ✅ |
| 功能特性 | 九 H5 设置页与桌面端全 tab 对齐（放开浏览器「两 pill」围栏） | —（新增） | ✅ |
| 工程/开发 | 十 本地开发模式注意事项（sidecar 开发模式跑通记录） | — | ✅ |
| 移动端/H5 | 十一 H5 悬浮快捷入口（任务列表 / 文件浏览 / 审查） | 旧§5.2 FAB（参考） | ⬜ |
| 工程/质量 | 十二 src/server 既有 22 条测试失败清零 | —（新增） | ✅ |
## 📦 联动 Patches

> 各优化项的实施 diff 以 patch 文件形式统一存放到本 `modify/` 目录（后期全部归档于此），与上文章节联动：每完成一项，patch 入库并在此登记；升级/重打基座时按本表逐个 `git apply` 重放。

### 命名与存放约定
- 存放：`modify/patches/`（patch 文件统一子目录）
- 命名：**按优化项语义归类，不用数字编号**——`<优化项短名>.patch`，短名直接取自该优化项的英文关键词（如 `h5-require-token.patch`、`session-export.patch`），一眼可读、与章节标题对应
- 生成：`git diff <基线> -- <涉及路径> > modify/patches/<优化项短名>.patch`，基线为应用该 patch 前的 commit
- 每章完成后在此表登记状态；冲突时以「该章节最新实施记录」为准重新出 patch

### Patch 清单

| Patch 文件 | 对应优化项（章节） | 基线 commit | 状态 |
|---|---|---|---|
| `patches/h5-require-token.patch` | 一 H5 令牌开关 + 免令牌豁免 | 2f8d819d (v0.6.6) | ✅ |
| `patches/h5-auto-mode-optin.patch` | 一 H5 选「自动模式」400 修复（1.1） | 2f8d819d (v0.6.6) | ✅ |
| `patches/h5-terminal-bridge.patch` | 一 H5 终端桥接（1.2） | 2f8d819d (v0.6.6) | ✅ |
| `patches/session-export.patch` | 二 会话导出 | 2f8d819d (v0.6.6) | ✅ |
| `patches/session-refresh.patch` | 三 会话刷新按钮 | 2f8d819d (v0.6.6) | ✅ |
| `patches/tps-indicator.patch` | 四 TPS 指示器 + 两行 | 2f8d819d (v0.6.6) | ✅ |
| `patches/file-download.patch` | 五 文件下载桥接 | — | ✅ |
| `patches/disable-updates.patch` | 六 禁止更新开关 | 4aaf425a | ✅ |
| `patches/cache-billing.patch` | 七 上下文缓存与计费显示 | e49e0b7d | ✅ |
| `patches/thinking-switch.patch` | 八 思考模式二级开关 | 6cc24ac9 | ✅ |
| `patches/h5-settings-parity.patch` | 九 H5 设置全 tab 对齐 | 2f8d819d (v0.6.6) | ✅ |
| `patches/h5-settings-whitelist.patch` | 九 H5 设置项 400/403 修复（9.x，remoteBrowser 白名单） | 6d4fd126 | ✅ |
| `patches/server-test-baseline-zeroing.patch` | 十二 src/server 既有 22 条测试失败清零 | 6d4fd126 | ✅ |
| `patches/h5-mobile-quick-actions.patch` | 十一 H5 悬浮快捷入口（任务/文件/审查） | — | ⬜ |

### 移植通用注意事项- stale `.js` 孪生：改 `src/*.ts` 走 sidecar 打包路径时，须核对被改文件同名 `.js` 是否存在且同步（旧树 `.js` 优先加载坑）。
- 0.6.6 已有对应能力需**融合**而非整块覆盖（如 H5 安全配对、缓存 token 显示、rewind 等），各章落地前先核对现状。
- 桌面 UI 项 i18n 需覆盖 5 语言（en/zh/jp/kr/zh-TW）。
- 验证：`bunx tsc --noEmit` + 相关 vitest + UI 人工验证。

---

## 一、H5 访问「需要访问令牌」开关 + loopback/私网/ULA 免令牌（源§二，✅ 2026-09-24）

### 需求背景

旧§二在 0.5.3 上实现：H5「需要访问令牌」开关 + loopback/RFC1918/ULA 私网来源免令牌（2026-08-11 补充私网豁免）。本次在 0.6.6 重实现，并与用户确认两点最终语义：
- **默认不启用 H5 令牌**（`requireToken: false`）= 0.0.0.0/0 全免 token；
- 开关开启（`true`）时：loopback + RFC1918（10/8、172.16/12、192.168/16、169.254）+ IPv6 ULA（fc00::/7）来源**按 socket 源地址**（`server.requestIP()`）免 token，公网来源需 Bearer token；
- 开关在桌面端设置 → H5 访问 tab 内联动（即时生效，非 draft/save 模式）。

### 0.6.6 现状核对

- 0.6.6 的 `H5AccessSettings`（`src/server/services/h5AccessService.ts`）**无 requireToken 字段**，`normalizeStoredSettings` 静默丢弃；token 是 H5 能力路径的唯一门槛。
- 策略单点 `shouldRequireH5Token`（`src/server/h5AccessPolicy.ts`）：h5Enabled && 能力路径 && `classify==='h5-browser'` → 要 token；loopback 请求被 `local-trusted` 分类直接豁免，**私网来源不豁免**（外部 IP 浏览器一律 h5-browser）。
- 桌面端 `desktopRuntime.ts` 的 `requiresH5AuthForServerUrl` 只豁免 loopback → LAN IP 打开 H5 即使服务端免 token 也会在前端弹 token 输入。

### 实施方案

服务端（4 文件 + 2 测试）：
- `h5AccessService.ts`：`H5AccessSettings` 加 `requireToken: boolean`（默认 false）；`DEFAULT_STORED_SETTINGS.requireToken = false`；`normalizeStoredSettings` 用 `value.requireToken === true` 解析（旧配置升级后默认关闭）；`toPublicSettings`/`updateSettings` 透传。
- `h5AccessPolicy.ts`：新增 `isPrivateIPv4Source`（RFC1918+169.254）与导出 `isTrustedLocalSourceHost(host)`（剥 bracket/`::ffff:` 前缀 → loopback → IPv6 走 ULA 正则 `/^f[cd][0-7][0-9a-f]:/` → 否则私网 IPv4）；`shouldRequireH5Token` 加必填 `requireToken`：`!requireToken → false`（全免），否则 `!isTrustedLocalSourceHost(clientAddress)`。
- `index.ts`：调用点传 `requireToken: h5Settings.requireToken`；`api/h5-access.ts`：PUT body 透传 `requireToken`。
- 测试：`h5-access-policy.test.ts` 全部调用加 `requireToken` 参数，loopback/私网源断言翻转为 false，新增私网豁免/公网需 token/requireToken=false 全开/`isTrustedLocalSourceHost` 边界（fd12 非 ULA、fd9a::7f 非 ULA、172.32 非私网等）用例。

桌面端（7 文件 + i18n 5 语言 + 测试）：
- `types/settings.ts`、`stores/settingsStore.ts`（DEFAULT false + normalize `=== true`）、`api/h5Access.ts` 加字段。
- `pages/settings/H5AccessSettings.tsx`：enabled 行下方新增 checkbox，onChange 直接 `updateH5AccessSettings({ requireToken })` 即时生效。
- `lib/desktopRuntime.ts`：`initializeBrowserServerUrl` 加 **tokenless 快速路径**——health 通过后先 `ensureBrowserApiAccessibleWithoutH5(url)` 探 `/api/status`（仅 401 才抛 `H5ConnectionRequiredError('missing-token')`），成功即 `setAuthToken(null)` 直连；仅 missing-token 时落入原 token 输入流程。
- i18n 5 语言各加 `h5AccessRequireToken`/`h5AccessRequireTokenHint` 2 key；`generalSettings.test.tsx`/`settingsStore.test.ts` fixture 补 `requireToken: false`，另 4 处 `updateH5AccessSettings` 精确匹配断言**不含**该字段（H5 save 处理器只发 3 字段，开关独立）。

### 验证

- 服务端 `bun test`：h5-access-policy 31/31 + h5-access-service 28/28 pass（含新增私网/ULA 边界用例）。
- 桌面端 vitest：`generalSettings.test.tsx` 131 pass、`settingsStore.test.ts` 64 pass、`desktopRuntime.test.ts` 30/30（新增 LAN 免 token 直连用例）；`tsc -b` exit 0。
- dev 7788 live（LAN 视角，`http://192.168.10.43:7788`）：
  - `requireToken=false`：LAN/loopback/模拟公网（XFF）无 token `/api/status`、`/api/sessions` 均 200；带 token 200。
  - `requireToken=true`（重启后）：LAN 无 token 200（私网豁免）、loopback 无 token 200、带 token 200。
  - 控制面（带 desktop process token `CC_HAHA_LOCAL_ACCESS_TOKEN`）：`PUT /api/h5-access {"requireToken": true/false}` 200 且 `settings.json` 落盘正确——UI 开关落地链路打通。
- 真实设备回归：192.168.10.140 手机此前弹「需要 token」，根因是 **dist bundle 过期**（旧 `requiresH5AuthForServerUrl` 逻辑），重 build + 重启后免 token 直连成功。
- Patch：`modify/patches/h5-require-token.patch`（基线 2f8d819d，v0.6.6）。

### 1.1 附带修复：H5 选「自动模式」持续 400（✅ 2026-09-24）

**问题**：H5（手机浏览器）会话中权限审批选择「自动模式」时，点确认后 toast 一直报错（400）。

**根因**：选自动模式会触发两步，第一步 `acceptAutoModeOptIn()`（`desktop/src/stores/settingsStore.ts:389`）走 `PUT /api/settings/user { skipAutoPermissionPrompt: true }`（`desktop/src/api/settings.ts:28`）。H5 请求被 `classifyH5Request` 判为 `h5-browser` → `router.ts:560` 置 `remoteBrowser: true` → `router.ts:67` 调 `validateRemoteSettingsPatch`（`src/server/remoteBrowserPolicy.ts:37`）。而 `WRITE_SETTINGS` 白名单（`remoteBrowserPolicy.ts:5`）只有 `language/chatSendBehavior/alwaysThinkingEnabled/workflowKeywordTriggerEnabled/outputStyle` 5 个字段，**不含 `skipAutoPermissionPrompt`**（该字段在 READ_SETTINGS 可读不可写）→ 400 `Unsupported General setting`。桌面端（local-trusted）不走此校验，故仅 H5 报错。

**修复**：`src/server/remoteBrowserPolicy.ts` `WRITE_SETTINGS` 加入 `skipAutoPermissionPrompt`（boolean，走既有末行 `typeof value === 'boolean'` 校验）。只翻一个持久化 userSettings 布尔位，风险等级与其它白名单布尔字段一致。

**验证**：
- 单测：`src/server/router.remoteBrowser.test.ts` 合法 patch 用例加入 `skipAutoPermissionPrompt: true`，并补「单独 PUT 该字段 200 + 落盘」「字符串值 `'true'` 仍 400」断言；8/8 pass。
- dev 7788 live（LAN 视角，h5-browser 分类）：`PUT /api/settings/user {skipAutoPermissionPrompt:true}` 修复前 400 → 修复后 200，且 `GET` 读回 `{"skipAutoPermissionPrompt":true}` 落盘正确。
- Patch：`modify/patches/h5-auto-mode-optin.patch`（基线 2f8d819d，v0.6.6，2 文件 37 行，`git apply --check` 干净应用）。

### 1.2 H5 终端桥接：让 H5 浏览器端也能用终端（✅ 2026-09-24）

**需求**：终端能力原本桌面独占——`browserHost.capabilities.terminal=false`（`desktop/src/lib/desktopHost/browserHost.ts:19`），`terminalApi.isAvailable()`（`desktop/src/api/terminal.ts:33`）在浏览器下为 false，`TerminalSettings.tsx` 只显示「unavailable」空态。目标是让通过 H5 访问的手机浏览器也能起一个真实 PTY 终端，默认工作目录跟随当前会话 workDir，功能完整对齐（含 shell 选择 + bash 路径设置）。

**现状核对（桌面如何走）**：桌面终端经 electronHost IPC（`terminalSpawn/Write/Resize/Kill` + 订阅 `terminalOutput/terminalExit`，`desktop/src/lib/desktopHost/electronHost.ts:179-189`，IPC 通道 `electron/ipc/channels.ts:54-55,101`）。服务端逻辑在 `electron/services/terminal.ts`：shell 解析 `resolveShell()`（`terminal.ts:613-622`）= `resolveDesktopTerminalShell`（仅 win32 生效，`terminal.ts:216-245`）?? `defaultShell`（`terminal.ts:201-214`，非 win32=`env.SHELL` 或 zsh/bash）；`terminalEnvironment`+`loginShellEnvironment`（`-l -c 'env -0'`）+`ensureUtf8Locale` 构造 env；min cols/rows=20/8；cwd 解析 `resolveTerminalCwd`。**前端 spawn 入参只有 `{requestId,cols,rows,cwd}`，shell 选择在服务端从 settings 读**（`TerminalSettings.tsx:320-325`），这是 H5 端要镜像的关键点。

**实施方案（最小改动：只换 `browserHost.terminal` 底层，xterm 层零改动）**：

- **服务端 `src/server/services/terminalService.ts`（新增，~836 行）**：镜像 `electron/services/terminal.ts` 的 shell/cwd/env/min 尺寸/事件逻辑。`TerminalService` 构造注入 `ptyFactory`；`attach(ws)`（接管存活 PTY 发 `terminal_sync`）、`detach(ws)`（owner 置空起 15s 宽限，`CC_HAHA_TERMINAL_DISCONNECT_GRACE_SECONDS` 覆盖）、`spawn/write/resize/kill`（owner 校验）、`getBashPath/setBashPath`（读写 `terminal-config.json` 的 `bash_path` 键，路径 `CLAUDE_CONFIG_DIR` 或 `~/.claude`）。`findNodePtyDir` 候选链：`CC_HAHA_NODE_PTY_DIR`→`CLAUDE_APP_ROOT`（.asar→.asar.unpacked/node_modules/node-pty，否则 node_modules/node-pty 与 desktop/node_modules/node-pty）→cwd/desktop/node_modules/node-pty，须 `package.json` 且 `build/Release/pty.node` 或 `prebuilds/<platform>-<arch>/pty.node`。
- **WS 通道 `src/server/ws/handler.ts`**：`WebSocketData.channel` 扩 `'terminal'`；open/message/close 加 terminal 分支→`getTerminalService().attach/detach`+`handleTerminalMessage`。入帧 `terminal_spawn/write/resize/kill`，回帧 `terminal_spawned/terminal_error/terminal_output/terminal_exited/terminal_sync`。
- **REST `src/server/api/terminal.ts`（新增）**：`GET/PUT /api/terminal/bash-path`（PUT body.bashPath 须 string|null 否则 400）；`router.ts` 加 `case 'terminal'`。
- **WS 路由 `src/server/index.ts`**：在通用 `/ws/` 之前插 `/ws/terminal` 分支（字面路径否则被 `/ws/{sessionId}` 吞）。**本块归 h5-terminal-bridge.patch；require-token 的 `serverFetch` 抽取 + unix-socket 测试设施归 h5-require-token.patch**（两 patch 对 index.ts 的改动不相交）。
- **远程设置 `src/server/remoteBrowserPolicy.ts`**：`DESKTOP_TERMINAL_SHELLS=['','system','pwsh','powershell','cmd','custom']`+`isDesktopTerminalPatch` 校验；`projectRemoteSettings` 投 `desktopTerminal`；`validateRemoteSettingsPatch` 首行放行 `desktopTerminal` 键。（本文件另有 auto-mode-optin 的 `skipAutoPermissionPrompt` 改动，两 patch 不相交。）
- **前端 `desktop/src/lib/desktopHost/terminalWs.ts`（新增，~282 行）**：`TerminalWebSocketClient` 独立单条 WS 通道（不复用 wsManager，因 chat 的 `ServerMessage` 协议与终端帧不匹配）。`buildTerminalWebSocketUrl()`=getBaseUrl→`ws(s)://<base>/ws/terminal`+`?token=`；指数退避重连 `min(1000*2^n,30000)`；SPAWN_TIMEOUT_MS=10000；spawn/write/resize/kill；onOutput/onExit/onSync 返回同步 unlisten。
- **前端 `browserHost.ts`**：`capabilities.terminal` false→true；terminal 命名空间改 WS 实现（`supportsStartupCorrelation:true`，spawn/write/resize/kill/onOutput/onExit 走 `getTerminalWsClient`；getBashPath/setBashPath fetch `/api/terminal/bash-path`）。
- **H5 入口 `desktop/src/pages/settings/H5Settings.tsx`**：terminal 分支渲染 `<H5TerminalSettings/>`（`useSessionStore` 取 `activeSession?.workDir ?? projectRoot` 作 cwd 传 `TerminalSettings showPreferences cwd`）。（本文件其余 16-tab 结构归 h5-settings-parity.patch。）
- **xterm 层 `TerminalSettings.tsx` 零改动**：它只经 5 个 API（spawn/write/resize/kill + onOutput/onExit）与底层解耦，换底层即生效。

**关键 Bug：Bun 下 node-pty 12ms SIGHUP 秒退（生产必中招）**：
- 症状：dev 7788 WS 手测，spawn 成功回 `terminal_spawned` 但 ~12ms 后收 exit 帧 `code:0, signal:"1"`（SIGHUP），write 报 'terminal session is not running'。
- 根因（隔离实验定位）：node-pty 1.1.0 的 JS 胶水 `lib/unixTerminal.js:93 new tty.ReadStream(term.fd)` 在 **Bun 1.3.14** 下首次 EAGAIN 即关流（+11ms），关流触发 close handler SIGHUP 掉 shell。**Node 22 下同样代码正常**（子进程 state=S 存活）。原生 pty.node 本身没问题。sidecar 运行时恒为 Bun（dev `bun run`；生产二进制为 bun compile 产物）→ 生产也会中招，必须按 Bun 兼容修。
- 修复：绕过 node-pty 的 UnixTerminal，直接调原生 `pty.fork`（签名 `pty.fork(file,args,env[](k=v),cwd,cols,rows,uid,gid,utf8,helperPath,onexit)→{fd,pid,pty}`），master fd 用异步 `fs.read` 非阻塞读（EAGAIN/EWOULDBLOCK 时 `setTimeout` 15-20ms 退避重挂、有数据立即再读排空、EIO=child 退出）；write=`fs.writeSync(fd,data)`，resize=`pty.resize(fd,cols,rows)`，kill=`process.kill(pid,'SIGHUP')`，onExit 用 pty.fork 的 onexit 回调。保持 `TerminalPtyProcess` 接口不变（TerminalService 逻辑不动）。CPU：15-20ms 轮询空闲约 24-28%，可接受为 v1。死路（勿重试）：Bun 下 `net.Socket({fd,writable:true})` 写即关、readable-only 0 字节；`process.binding('fs')` 无 fcntl 无法 JS 侧改阻塞。
- 另修 `stopSession` 竞态：原实现先 `sessions.delete` 再 `pty.kill()` 导致退出事件找不到会话不发 exit 帧；改为置 `session.exited=true` 不删 map，让 pty 真实退出事件走 `removeSession` 发 `terminal_exited` 帧并清理，加 500ms unref timer 兜底。

**Bug 2（H5 LAN 访问）：`crypto.randomUUID` 非安全上下文抛错**（`TerminalSettings.tsx`）：
- 症状：H5 通过 LAN IP（`http://192.168.x.x:port`）访问点开终端直接报错；loopback（127.0.0.1）一切正常，故最初 live 验证全绿掩盖了它。
- 根因：`crypto.randomUUID` 仅在**安全上下文**（HTTPS 或 localhost/127.0.0.1）可用；LAN IP 走普通 http 是非安全上下文，`crypto.randomUUID` 为 `undefined`，`startTerminal` 里 `crypto.randomUUID()` 抛 `TypeError: crypto.randomUUID is not a function`，被 `catch` 捕获后显示在终端面板错误条。
- 修复：照抄 `McpSettings.tsx` 的 `createId` 范式，加 `createTerminalRequestId()` 回退（`typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 't-'+Date.now()+'-'+Math.random().toString(36).slice(2)`）。独立 commit `71ac3073`。LAN live 复现：终端正常打开、`echo` 回显、console 无报错。

**验证**：
- 服务端单测：`src/server/__tests__/terminal-service.test.ts` 11/11（FakePty 注入）；WS 通道 `websocket-handler.test.ts` 103/103。
- 前端：`desktop tsc -b` exit 0；vitest `terminal.test.ts`(2)+`contract.test.ts`(10)=12/12；`vite build` 新 bundle。
- dev 7788 live（LAN 192.168.10.43 带 H5 token）：spawn→PROMPT→write `echo`→resize 100x30→kill→`terminal_exited{code:0,signal:"1"}` 帧全 ✓（`/tmp/ws-full-final.mjs`）。
- Patch：`modify/patches/h5-terminal-bridge.patch`（基线 2f8d819d，v0.6.6，12 文件 1961 行，4 个新文件带 `new file mode`）。**已验证 5 patch 全链（h5-require-token→h5-auto-mode-optin→session-export→h5-settings-parity→h5-terminal-bridge）`git apply` 干净应用，且逐字节等于当前工作树**（34 个覆盖文件 diff 全空）。

---

## 二、会话导出功能（源§三，✅ 2026-09-24）

### 需求背景

旧§三在 0.5.3 上实现：会话列表右键菜单新增「导出会话」，支持导出 **Markdown / HTML / 纯文本**，并可选导出范围（默认「最近一次压缩 → 最新消息」，可选具体压缩边界节点或「全部」）。0.6.6 中该功能不存在，本次以旧 fork 树（`CC-HAHA-Scode`）的完整实现为参考移植到 0.6.6 基座。

### 0.6.6 现状核对

- compact 边界 JSONL 行形态 `{type:'system', subtype:'compact_boundary'|'microcompact_boundary', content:'Conversation compacted'|'Context microcompacted', timestamp, uuid, ...}`（`src/utils/messages.ts:4744-4797` `createCompactBoundaryMessage`/`createMicrocompactBoundaryMessage`），**无 `message` 字段**。
- 服务端 `entriesToMessages`（`src/server/services/sessionService.ts:5183`）以 `if (!entry.message?.role) continue` 把所有无 `message.role` 的条目（含 compact 边界）过滤掉，且 `MessageEntry`（服务端 `:218` / 前端 `desktop/src/types/session.ts:46`）**无 `subtype` 字段** → 前端从 `/api/sessions/:id/messages` 拿不到边界节点，无法切分导出范围。
- 前端 API 方法 0.6.6 名为 `sessionsApi.getFullHistory(sessionId)`（`desktop/src/api/sessions.ts:447`，返回 `{messages, page}`），旧版用的 `getMessages` 已不存在。
- UI 已能渲染 compact：`mapHistoryMessagesToUiMessages`（`desktop/src/stores/chatStore.ts:7699-7708`）把 `type:'system' && content==='Conversation compacted'` 映射为 `compact_summary` → 放行边界条目与现有 UI 行为一致，无回归。
- 0.6.6 已具备所需 UI 原语 `Modal`/`SelectField`/`Button`（`desktop/src/components/ui/`）；右键菜单在 `desktop/src/components/layout/Sidebar.tsx`（「重命名」/「删除」项，H5 手机共用同一 Sidebar）。

### 实施方案

- **服务端**（`src/server/services/sessionService.ts`）：`MessageEntry` 加 `subtype?: string`；`entriesToMessages` 在 `if (!entry.message?.role) continue` 之前对 `type==='system' && subtype ∈ {compact_boundary, microcompact_boundary}` 特殊放行，push `{id, type:'system', subtype, content, timestamp}` 后 `continue`。其余逻辑不变。
- **前端类型**（`desktop/src/types/session.ts`）：`MessageEntry` 加 `subtype?: string`。
- **导出渲染器**（新增 `desktop/src/lib/sessionExport.ts`，移植旧实现 248 行）：`renderMessagesToMarkdown/Html/PlainText`（user→引用块 / assistant→正文 / system→斜体 / tool_use·tool_result→代码块；compact 边界渲染为分隔标注）；`collectExportNodes`/`isCompactBoundaryEntry`（按 `subtype` 判定）；`formatExportFilename`（`<时间戳>-<标题>.<ext>`）；`downloadExport`（Blob + `<a download>`，桌面/H5 浏览器通用）；HTML 内联 CSS 含深色模式适配。
- **导出对话框**（新增 `desktop/src/components/ExportConversationDialog.tsx`，移植 + 适配）：格式选择（md/html/txt）+ 范围选择（最近压缩→末尾 默认 / 各边界节点 / 全部）+ 下载；唯一适配点 `getMessages` → `getFullHistory`（`handleExport` 与 `ExportRangePicker` 两处）。
- **右键菜单**（`desktop/src/components/layout/Sidebar.tsx`）：加 `exportTarget` 状态；「重命名」与「删除」之间插入「导出」项（取会话 title）；组件返回体渲染 `<ExportConversationDialog />`。
- **i18n**（5 语言 en/zh/jp/kr/zh-TW）各加 6 key：`session.export.title/.export/.format/.range/.range.latest/.range.all`。

### 验证

- 类型：desktop `tsc -b` exit 0。
- desktop vitest：6137 pass，2 个既有失败（`providerModels.test.ts` / `MessagePayloadRetention.test.tsx`，未触及，不变）。
- 服务端 `bun test`：session 相关失败集（`sessions.test.ts`/`session-messages-http.test.ts`/`session-summary.test.ts` 共 5 个）在改动前后**完全一致**（stash 对比），确认本次 `entriesToMessages` 放行未引入新失败（其余 h5-access 失败属第一章 h5 改动域，环境/集成既有）。
- **live E2E（dev 7788，重启 sidecar 加载服务端改动）**：向会话 JSONL 追加一条标准 `compact_boundary` 行后，`GET /api/sessions/:id/messages?mode=full` 返回 11 条消息且其中 1 条 `subtype: compact_boundary`、`content: 'Conversation compacted'`、`id` 与 uuid 一致——边界节点端到端带出（验证后已还原 JSONL 为 25 行）。
- 前端 bundle：重 build 后 `session.export.*` 文案与导出组件均进 `App-*.js`/`i18n-*.js`，已伺服 7788。
- **待手机实测**：192.168.10.140 长按会话 →「导出会话」→ 选格式/范围 → 下载，核对 md/html/txt 内容与边界分隔。
- Patch：`modify/patches/session-export.patch`（基线 2f8d819d，v0.6.6，10 文件 588 行）。已验证 `git apply --check` 在**纯 v0.6.6 基线**与**基线+第一章 h5 patch 链式**下均可干净应用（i18n 与 h5 patch 各自 key 域不相交，应用顺序不限）。

---

## 三、会话刷新按钮（授权/提问卡住软刷新规避）（源§八，✅ 2026-09-24）

### 需求背景

会话中需要用户授权（can_use_tool）或提问问答（AskUserQuestion）时，有概率卡在「准备工具」不弹授权/问答对话框。根因是实时 WS 投递链路在特定条件下丢弃消息（`forwardCliMessageToSessionClients` 在 `clients.size===0` 时 return、`bindClientSessionOutput` 在 transcript epoch 不匹配时 return），而服务端 `pendingPermissionRequests` **总是完整记录**——刷新页面重连后服务端重放 permission 消息即可恢复。方案：手动「刷新会话」软刷新按钮，无需整页刷新。

### 0.6.6 现状核对（调研结论）

- **服务端重放机制已存在，无需新增**：`src/server/ws/handler.ts:639-646` 每个新连接/重连的 open 必发 `replayPendingPermissionRequests`（:4269-4286 逐条重发 `{type:'permission_request'}`）+ `{type:'permission_requests_snapshot', toolRequestIds, computerUseRequestIds, turnActive}`。
- pending 存储：`conversationService.ts:227-237` 内存 `Map<requestId,...>` 挂 session，不落盘；断连宽限 30 分钟（`handler.ts:162 PENDING_PERMISSION_DISCONNECT_CLEANUP_MS`）。**AskUserQuestion 与 can_use_tool 是同一套 pending 机制**（`tool_name:'AskUserQuestion'` 进同一个 `pendingPermissionRequests`）。
- 历史重拉：独立 HTTP API `GET /api/sessions/:id/messages?mode=full`（`api/sessions.ts:193-201`，读磁盘 transcript JSONL）——可补回 CLI 已写入的 AskUserQuestion tool_use。
- 前端现成 API：`chatStore.disconnectSession(id)`（:3180）→ `connectToSession(id)`（:2941，重连触发服务端重放+全新 bootstrap 拉历史）→ `reloadHistory(id)`（:4003，无 guard 调用时直接应用结果；与 bootstrap 有 lifecycleGeneration 协调，重复拉取幂等）。
- 挂载点：桌面 `SessionChatHeader` 已支持 `actions` prop（`SessionChatSurface.tsx:61` 渲染标题右侧）；移动端 `AppShell.tsx` `mobile-session-header`（0.6.6 只有侧栏 toggle 按钮，无菜单）。

### 实施方案（纯前端，7 文件 73 行）

- **handler（两处各一份，同逻辑）**：`useState refreshingSession` 防重入；`disconnectSession(activeTabId)` → 等 120ms → `connectToSession(activeTabId)`（服务端重放 permission_request/snapshot）→ `await reloadHistory(activeTabId)`（补 AskUserQuestion tool_use）。函数经 `useChatStore.getState()` 取（避免订阅 churn）。
- **桌面**：`desktop/src/pages/ActiveSession.tsx` 加 `handleManualRefresh`，按钮挂 `SessionChatHeader actions`（`Button variant="ghost" size="sm"`，`refresh` material icon，刷新中 `animate-spin`，`data-testid="session-manual-refresh"`）。
- **移动端**：`desktop/src/components/layout/AppShell.tsx` 加 `handleManualRefresh`（加 `isActiveChatTab` 门控），`IconButton` 挂 `mobile-session-header` 尾部（icon `refresh`/刷新中 `progress_activity`，`size="2xl"`，`data-testid="session-manual-refresh-mobile"`，仅 chat tab 渲染）。
- **i18n**：新增 `chat.refreshSession` 5 语言（en 'Refresh session' / zh '刷新会话' / zh-TW '重新整理對話' / jp 'セッションを更新' / kr '세션 새로고침'）。
- 参照旧 fork（CC-HAHA-Scode 2026-08）同功能实现，0.6.6 挂载点/组件名以本基座实际代码为准。

### 验证

- `desktop tsc -b` exit 0；vitest `AppShell.test.tsx` + `ActiveSession.test.tsx` 54/54 pass（chatStore mock 已含 disconnectSession/connectToSession/reloadHistory）。
- `vite build` 成功，新 bundle `App-BVVJKg7-.js`；dev 7788 伺服 dist/ 即生效（H5 会话页标题栏/移动端 header 右侧可见刷新按钮）。
- Patch：`modify/patches/session-refresh.patch`（基线 2f8d819d，7 文件 171 行）。**6 patch 全链（require-token→auto-mode-optin→session-export→settings-parity→terminal-bridge→session-refresh）`git apply` 全成功，结果与当前工作树逐字节一致（41 文件 0 差异）**。

---

## 四、实时解码速度（TPS）指示器（源§九）+ 手机端顶栏两行显示（源§十六，✅ 2026-09-24）

### 需求背景

会话流式输出时显示实时解码速度（token/秒），帮助用户感知模型吞吐；移动端顶栏空间有限，指示器改为两行竖排（TPS 标签 + 数值）。

### 0.6.6 现状核对

- 0.6.6 无任何 TPS 相关代码；chatStore 已有 `appendPendingDelta`（content_delta 缓冲，:1026 区）与 `appendPendingToolInputDelta`（工具入参流式 JSON 缓冲）——两处都是「新 token 到达」的准确喂入点。
- 无 `subagent_tps` 消息类型（老 fork 有，0.6.6 无）→ 该项省掉。
- 桌面挂载选 `SessionChatHeader actions` 簇（与刷新按钮同侧），而非 metadata 行——metadata 行有「分隔符数量」契约测试（ActiveSession.test.tsx:2486），塞入会破坏「空闲会话恰 3 项 2 分隔符」断言。

### 实施方案（12 文件，3 新文件）

- **`desktop/src/lib/tpsMeter.ts`（新增，移植自老 fork）**：1.5s 滑动窗口字符增量→token/s；CJK≈1 token/字、ASCII≈1/3.5 字（`estimateTokens`）；会话结束瞬间 2s 平均 fallback 保持速度不骤降 0（`computeFallbackTps`，跳过最近 300ms 流切换）；`SPARSE_SPEED_THRESHOLD=5` 流边界（text↔thinking↔tool）稀疏读数回退 fallback。
- **`desktop/src/components/chat/TpsIndicator.tsx`（新增，移植+量身定制）**：180ms 轮询；四档着色 <27红/<53橙/<80绿/≥80紫；5 分钟空闲隐藏；组件内 30%+70% 指数平滑；**`vertical` prop 两行竖排**（移动端用）；opt23 §11.27 `Math.max(span, windowMs/1000)` 防移动端突发批量 content_delta 虚高；**硬编码中文改 i18n**（`useTranslation` + `chat.tpsSpeedTitle`/`chat.tpsLabel` 5 语言）。
- **chatStore 接入**：`tpsMeterBySession: Map<string,TpsMeter>` + 导出 `getSessionTpsMeter(sessionId)`（懒创建）；`appendPendingDelta`/`appendPendingToolInputDelta` 末尾 `if (isTpsEnabled()) meter.push(text)`（工具入参 JSON 也算解码速度）；`disconnectSession` 清理 `tpsMeterBySession.delete(sessionId)`。
- **挂载**：桌面 `ActiveSession.tsx` 挂 `SessionChatHeader actions`（TPS 在刷新按钮左侧，横排）；移动 `AppShell.tsx` mobile-session-header 刷新按钮左侧 `vertical` 两行。
- AppShell.test.tsx 的 chatStore mock 补 `getSessionTpsMeter` stub（hasStreamed: false → 指示器隐藏，不影响既有断言）。

### 验证

- `desktop tsc -b` exit 0；vitest `tpsMeter.test.ts` 4/4（fallback 保速/稀疏边界/350ms 跳过/token 估算校准）+ AppShell 22/22 + ActiveSession 32/32；全量前端 vitest **6141 pass / 2 fail**（2=基线既有 providerModels、MessagePayloadRetention，零回归）。
- `vite build` 成功，新 bundle `App-BTQt5ZiK.js`。
- 坑：TpsIndicator 早期 `if (!isTpsEnabled()) return null` 在 hooks 之后 → `useTranslation` 须声明在早退之前。
- Patch：`modify/patches/tps-indicator.patch`（12 文件 633 行，3 新文件 mode 100644）。

### 子优化（2026-09-25）：起步速度更准确 + 标签精简

- **起步速度修正（tpsMeter.ts）**：新增 `BURST_FLOOR_MS=400`，`value()` 改 `elapsed = Math.max(span, BURST_FLOOR_MS/1000)`（替换原 `Math.max(span, windowMs/1000)` + <0.05 外推分支）。作用=回合并流初期不再被摊到整窗 1.5s 而低估（20 token 突发从虚高 2000 降到 ~75），UI 30/70 指数平滑兜底。
- **标签去冗（TpsIndicator.tsx）**：桌面 `42 t/s`（删「TPS」词与 `chat.tpsLabel` 前缀，min-w-[6ch]）；移动两行 `TPS`/`42`（删 `t/s`）；title 保留 `chat.tpsSpeedTitle`。色档 27/53/80 未动。
- **i18n**：5 语言（en/zh/zh-TW/jp/kr.ts）删无引用的 `chat.tpsLabel` 行。
- 验证：tsc -b exit 0；全量前端 vitest 6144 pass / 2 fail（2=既有，零回归）；vite build `App-CJApNwcB.js`。
- Patch 重生成：`tps-indicator.patch` 12 文件 633 行（含子优化终态）。

> 注：上下文面板「生成速度」口径修正（decode-only，分母用 `totalDecodeDuration` 而非 `totalAPIDuration`）归**第七章**（cache-billing.patch），见该章。
---

## 五、文件下载桥接功能（源§十二，✅ 2026-09-24）

### 需求背景

H5 浏览器端打开文件链接时，`/local-file/<absPath>` 直接内联显示而非触发下载，需要 `Content-Disposition: attachment` 头让 H5 真正下载文件；会话导出的文件列表卡（DownloadReferencesCard）需要展示文件名/大小/下载按钮，大小走批量 `/local-file/info` 端点一次拿全。

### 0.6.6 现状核对

- 服务端 `localFile.ts` 只有 `?download=1`/`?info=1` 未实现，`/local-file/` 走 `serveFileWithRange` 内联返回；`previewFs.ts` 有 `downloadHeadersFor()`（RFC5987 attachment 头）与 `servePreviewFsFile(download=false)` 参数预留，但路由没读 query 没传参。
- 前端无 `DownloadReferencesCard` / `fileSizeCache` / `downloadFileMeta`（三者均老 fork 独有，0.6.6 全缺）；`localFileUrl` 已在 `handlePreviewLink.ts:44-51`。
- 老 fork 完整实现=4 块：①localFile.ts `?info=1`/`?download=1` 分支 + `handleBatchLocalFileInfo`（POST `/local-file/info`）；②previewFs.ts 路由读 `?download=1` 传 `servePreviewFsFile`；③`DownloadReferencesCard.tsx`（收集 turn 内 Read 调用，`localFileUrl+?download=1`）；④`fileSizeCache.ts`（hot 50/120s→cold 150/30min，localStorage 持久化）+ `downloadFileMeta.ts`（fileTypeIcon/formatFileSize）。

### 实施方案（12 文件，3 新文件）

- **`src/server/api/localFile.ts`**：`?info=1`→JSON `{name,size,mime}`（`Bun.file().stat()`，不读内容）；`?download=1`→`serveFileWithRange(...,downloadHeadersFor())` 加 RFC5987 attachment 头（unicode/空格文件名正确）；`handleBatchLocalFileInfo(body)`：批量 stat，逐 path 走 `$HOME` sandbox，失败的静默跳过，返回 `{files:{path:{name,size,mime}}}`。
- **`src/server/index.ts`**：`POST /local-file/info` 路由插在 `/local-file/` 前缀分支**之前**（`/local-file/info` 也匹配该前缀，顺序敏感）。
- **`src/server/api/previewFs.ts`**：`handlePreviewFs` 读 `?download=1` 传 `servePreviewFsFile`；`servePreviewFsFile` 加 `download` 参数——download 时跳过 HTML base-rewrite 变换直接流式 + attachment 头（浏览器要原始字节非预览变换版）。
- **前端 3 新文件**：`fileSizeCache.ts`（两级 LRU，hot 50/120s + cold 150/30min，LRU 淘汰，localStorage `cc-haha:file-sizes` 持久化，`__clearFileSizeCache` 测试用）；`downloadFileMeta.ts`（fileTypeIcon 按扩展名映射 Material Symbols 图标 + formatFileSize 自适应单位）；`DownloadReferencesCard.tsx`（`TurnDownloadCard` 收集 turn 内 Read 调用的 `file_path`，去重；默认折叠不请求，展开时批量 `POST /local-file/info` 拿缺失大小并写入两级缓存；20 条分页 + "显示更多" + "显示全部"；下载链接=`localFileUrl+?download=1`）。
- **`ToolCallGroup.tsx` 接入**：import `TurnDownloadCard`；memory 分支（`MemoryToolActivityGroup` 后）与常规 return（`ToolCallGroupContent` 后）各插一处 `<TurnDownloadCard toolCalls={...} />`。
- i18n：`chat.downloadableFiles`/`chat.downloadableMore`/`chat.downloadableAll`/`workspace.download` 5 语言，插在 `chat.tpsSpeedTitle` 行后。

### 验证

- `desktop tsc -b` exit 0；`bun test src/server/api/__tests__/{localFile,previewFs}.test.ts` 45/45；`vitest chatBlocks.test.tsx` 44/44（含 ToolCallGroup）；全量前端 vitest **6141 pass / 2 fail**（2=基线既有 providerModels、MessagePayloadRetention，零回归）。
- `vite build` 成功，新 bundle `App-mQlq5B0F.js`。
- **权威零回归**：全量 `src/server` bun test junit 比对基线 worktree（2f8d819d）——新增 1 条 `diagnostics API`，单独跑 3 次（当前树+基线各 37/37 全绿）确认负载 flaky，非引入。
- 坑：`previewFs.ts` 0.6.6 缺 `downloadHeadersFor` 定义（仅老 fork 有）→ import 时报 `Export named 'downloadHeadersFor' not found`，需从老 fork 移植到 `serveFileWithRange` 后。
- Patch：`modify/patches/file-download.patch`（12 文件 698 行，3 新文件 mode 100644）。**8 patch 全链 `git apply` 干净且逐字节等于工作树（56 文件 0 差异）**。

---

## 六、设置-关于-更新：禁止更新开关（源§十三，✅ 2026-09-25）

### 需求背景

源§十三：桌面端 设置→关于→更新 区域加「禁止更新」开关，彻底关闭自动更新检查与下载（0.5.x 现状：启动即 `checkForUpdates({silent:true,autoDownload:true})` 检查+自动下载，AboutSettings 仅手动检查按钮，无开关）。

**语义决策（用户拍板）= 完全禁用（含手动）**：启动检查跳过 + 手动「检查更新」按钮置灰。`checkForUpdates` 外部调用方仅 AboutSettings 按钮一处，守卫放在 store 层即可全覆盖。

### 0.6.6 现状核对

- 更新系统：`UpdateChecker.tsx` 挂载即 `useUpdateStore.initialize()`；`updateStore.initialize()` 延迟 5s 后 `checkForUpdates({silent:true})`（startupCheckPromise 单飞）；`checkForUpdates({silent,autoDownload})` 内 `autoDownload && (shouldOffer||!silent)` 触发 `downloadUpdate()`。
- 设置持久化=REST `/api/settings/user`，服务端 `settingsService.updateUserSettings` 顶层浅合并（`Object.assign`）→ **新 boolean 字段服务端零改动**（照 `autoDreamEnabled` 完整 boolean toggle 范式）。
- **坑（live 发现）**：H5 浏览器端（`remoteBrowser=true`，由 `classifyH5Request==='h5-browser'` 判定）走 `router.ts:68 validateRemoteSettingsPatch`（`WRITE_SETTINGS` 白名单）与 `:93 projectRemoteSettings`（`READ_SETTINGS` 投影）——新 key 两侧都不在名单 → PUT 400「Unsupported General setting」+ 乐观更新回弹、GET 读回永远 false。loopback 桌面直连不走此路径（loopback curl 200），所以单测全绿仍会漏。

### 实施方案

1. `desktop/src/types/settings.ts`：`UserSettings` 加 `disableUpdates?: boolean`（webSearch 与 updateProxy 之间）。
2. `desktop/src/stores/settingsStore.ts`：`disableUpdates: boolean` 字段（初始 false）+ hydrate `userSettings.disableUpdates === true` + `setDisableUpdates(enabled)` 乐观 set→`settingsApi.updateUser`→失败回滚 throw（照 `setAutoDreamEnabled`）。
3. `desktop/src/stores/updateStore.ts` 两处守卫：`initialize()` 在 `getUpdateHost()` 后、`checkForUpdates()` 在 host 判定后各加 `if (useSettingsStore.getState().disableUpdates) return (null)`——启动/手动检查全拦，自动下载随检查入口一并停。
4. `desktop/src/pages/settings/AboutSettings.tsx`：Check now 按钮 `disabled={disableUpdates}`；按钮块后插 `Switch`（label/description 走 i18n）——「关于」tab 桌面+H5 共用（H5Settings.tsx:92 已渲染 AboutSettings）。
5. **`src/server/remoteBrowserPolicy.ts`**：`disableUpdates` 加进 `READ_SETTINGS` 与 `WRITE_SETTINGS`（boolean 走默认 `typeof value==='boolean'` 校验）——H5 手机可读写该开关（同 `skipAutoPermissionPrompt` 先例）。
6. i18n `update.disableUpdates`/`update.disableUpdatesDescription` 5 语言（en/zh/zh-TW/jp/kr，插在 `update.failed` 后）。
7. 测试：`updateStore.test.ts` +2（disableUpdates 时手动 check 返回 null 且不触发 check；initialize+fakeTimers 6s 启动检查不触发）；`remoteBrowserPolicy.test.ts` +3 断言（`validateRemoteSettingsPatch({disableUpdates:true})` true、非 boolean false、`projectRemoteSettings` 透传）。

### 验证

- 桌面 `tsc -b` exit 0；`updateStore.test.ts` 20/20；全量前端 vitest **6143 pass/2 fail**（2 条=基线既有 providerModels、MessagePayloadRetention，零回归）；`remoteBrowserPolicy`+`router.remoteBrowser` 10/10。
- vite build → App-BxBY2ThW.js；dev 7788 live（H5 关于页）：开关开→persisted=true+「检查更新」置灰、关→persisted=false+恢复，console 无错（400 修复前开关回弹）。
- **坑实录**：初版漏改 `remoteBrowserPolicy.ts` → H5 PUT 400、开关回弹（loopback curl 200 未暴露）；补 READ+WRITE 白名单后 H5 读写全通。
- Patch：`modify/patches/disable-updates.patch`（12 文件 302 行）。**9 patch 全链 `git apply` 干净且 disable-updates 12 文件逐字节等于工作树（0 差异）**。

---

## 七、上下文缓存与计费显示（源§十四，✅ 2026-09-25）

### 需求背景

旧 fork 的「缓存命中率」读数用的是**全会话累计口径**（`cacheRead / 全会话 prompt`）。长 agent 会话里每轮都会重放前文 prompt，累计比值被历史轮稀释到 ~0.5%，用户看到的命中率与当前缓存实际表现严重不符。本项要做两件事：

1. **缓存命中率口径修正**：从「会话累计」改为**请求级最新轮** `cacheRead / (input + cacheRead + cacheWrite)`——即「本轮提示词里有多少来自缓存」，实测 99.798%，才反映缓存的真实逐轮表现。
2. **会话总费用显示**：在会话 header 上展示会话累计费用，USD + CNY 双显示。

用户拍板（AskUserQuestion）：显示位置「三处全做（header 费用徽标 + 上下文指示器缓存尾巴 + 上下文面板详情行），但根据当前新源码重新制定更优雅的融合效果，老优化项的显示方式不需要完全遵守」；货币口径「USD/CNY 双显示，CNY = USD × 7.2 固定汇率（仅展示，非计费换算）」。

### 0.6.6 现状核对

- **数据全部现成，无需新端点**：
  - `desktop/src/api/sessions.ts:187-222` `SessionUsageSnapshot` 已带 `totalCostUSD` / `costDisplay`（会话累计，服务端预格式化）。
  - `desktop/src/api/sessions.ts:270-275` `SessionContextSnapshot.apiUsage = {input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens} | null`（最新一轮请求级用量，live 路径也回填；`input_tokens` 已是纯 fresh 语义）。
  - `getSessionUsage(sessionId, signal)` → `GET /api/sessions/{id}/inspection?includeContext=0&usageOnly=1`（单 CLI control，廉价，可轮询）。
- `desktop/src/lib/sessionUsageMetrics.ts` 已有 `deriveSessionUsageMetrics`（含会话累计 `cacheHitRate`）/ `formatCacheHitRate`，但无请求级命中率、无 CNY 格式化。
- 三处展示位：上下文指示器 `ContextUsageIndicator.tsx`（含详情 `ContextUsageDetails.tsx`）、上下文概览 `LocalSlashCommandPanel.tsx` 的 `ContextOverview`、会话 header（桌面 `pages/ActiveSession.tsx` + 移动 `components/layout/AppShell.tsx`）。

### 实施方案

1. **`sessionUsageMetrics.ts`**：新增 `latestTurnCacheHitRate({input_tokens, cache_creation_input_tokens, cache_read_input_tokens}): number|null`（`promptTokens = input+cacheRead+cacheWrite`，`=0` 返回 null）——请求级命中率的核心；新增 `CNY_PER_USD = 7.2` 与 `formatCnyCost(usd)`（`¥`，>0.5 两位小数、否则四位，与 USD 同精度对齐）、`formatCompactTokens`（`1.2M/375K/812`）。
2. **`ContextUsageDetails.tsx`**：`ContextUsageSessionStats` 增 `cacheReadTokens` + `totalCostUSD`；`SessionStatGrid` 缓存命中行 rate 非 null 时橙色 `#ea580c` + 行内 compact tokens；费用行旁增 `· ¥…` CNY span。
3. **`ContextUsageIndicator.tsx`**：`latestTurnUsage = displayContext?.apiUsage ?? null`，派生 `latestCacheRate` / `latestCacheReadTokens`；触发容器改 `relative flex`，环形按钮旁增兄弟节点缓存命中尾巴 `data-testid="context-cache-hit-tail"`（`#ea580c` 10px，无数据不显示，title 走 `contextIndicator.cacheHint`）；详情面板 `sessionStats` 以最新轮命中率为首、回退会话累计。
4. **`LocalSlashCommandPanel.tsx`**：`ContextOverview` 头部用量行增 `98% cached`（`#ea580c`）；第 4 个 pill 在有 cache 时换为 cache 命中行（`formatCacheHitRate` + compact tokens 明细），否则保留原 context pill。
5. **`SessionCostBadge.tsx`（新增）**：会话 header 费用徽标。挂载读一次 `getSessionUsage`（`usageOnly` 廉价路径），`produced=0`（无 input+output+cache tokens）不显示（避免首轮前 `$0.0000` 读成测量值）；`active` 时 `setInterval` 10s 轮询（cost 只在 turn 完成时变，但 turn 可跑数分钟），`inFlight` 防堆叠；pill 双币（compact 移动端仅 USD），`data-testid="session-cost-badge"`。
6. **挂载**：桌面 `pages/ActiveSession.tsx` 会话 header actions 区（TpsIndicator 与刷新按钮之间，`active={chatState!=='idle'}`）；移动 `components/layout/AppShell.tsx` 移动 header（TpsIndicator vertical 后，`active={activeTab?.status==='running'}` + `compact`）。
7. **i18n（5 语言）**：各增 `slash.inspector.context.cache` / `.cached`、`contextIndicator.cacheHint`（`{percent}` `{tokens}`）、`session.totalCost` 共 4 key。

### 验证

- 桌面 `tsc -b` exit 0；受影响 4 测试文件 **84/84**（ContextUsageIndicator 27 / LocalSlashCommandPanel 3 / AppShell 22 / ActiveSession 32）；全量前端 vitest **6143 pass/2 fail**（2 条=基线既有 providerModels、MessagePayloadRetention，零回归）。
- vite build → App-C54fEqkT.js（2200.13 kB，2.66s）。
- **dev 7788 live（127.0.0.1 agent-browser 进会话）**：header 费用徽标 `$0.87 · ¥6.27`（USD+CNY 双显示）+ 上下文指示器缓存尾巴 `96.7%`（`apiUsage` 有值时；estimate 路径 `apiUsage=undefined` 时尾巴隐藏、徽标仍显示 totalCost），console 无错。
- **布局微调**（2026-09-25 追加，live 双端像素级验证）：缓存百分比尾巴相对触发**按钮**定位——桌面 32px 按钮/20px 可见圆环（6px padding）、移动 44px 触摸目标/22px 圆环（11px padding），同一 translate 值被移动端多出的 5px padding 吞掉（表现为"左挪无效"）。终值：尾巴 `transform: isMobileBrowser ? 'translate(-9px, 3px)' : 'translate(-4px, 3px)'`（两端均达「距可见圆环 2px + 下移 3px」）；整组（环+百分比）外层容器 `transform: translateX(15px)`（composer 工具栏右对齐，用 transform 而非 margin——首子项 margin-left 只加空 flex-1 间隙不挪元素；15px 使尾巴右缘与右侧 check 图标留 4.5px，不再贴死）。

### 子优化（2026-09-25）：上下文面板「生成速度」口径修正（decode-only）

- **根因**：`sessionUsageMetrics.ts` 的 `deriveSessionUsageMetrics` 原来用 `totalAPIDuration`（= 解码时长 + TTFT 首 token 等待）作分母算 `tokensPerSecond`，把首 token 等待混入「生成时间」→ 上下文面板「生成速度」实测偏低 ~24%（46.2 vs 真实 61.0）。
- **修正**：分母改用 `totalDecodeDuration`（纯解码时长），`decodeMs > 0` 时优先；否则回退 `totalAPIDuration`。`generationMs = decodeMs > 0 ? decodeMs : apiMs`；`tokensPerSecond = generationMs > 0 && output > 0 ? output / (generationMs/1000) : null`。
- **测试**：`sessionUsageMetrics.test.ts` 3 处更新（500=1000/2s；回退 API=200；双 0→null；长会话 166998/326）；`ContextUsageIndicator.test.tsx:894-895` 断言 57→200（2400/12s decode）。
- **live 7788 确认**：上下文面板「生成速度」= `61tok/s`（改前 46.2；会话 f1be2b52 数据 totalAPIDuration=66971/totalDecodeDuration=50702/totalTtftDuration=16243/output=3095）。
- 验证：tsc -b exit 0；5 受影响文件 107/107；全量前端 vitest 6144/2（既有）；vite build `App-CJApNwcB.js`。
- **Patch**：`modify/patches/cache-billing.patch`（14 文件 650 行，含本口径修正 2 测试文件）。**10 patch 全链 `git apply` 干净且 cache-billing 14 文件逐字节等于工作树（0 差异）**。

---

## 八、思考模式二级开关：think 是否回传后端 API（源§二十五，✅ 2026-09-26）

### 需求背景

CC-HAHA 默认把上一轮 thinking 全文发回后端（Anthropic 格式原样透传，且 1P/Bedrock/Vertex 还发 `context_management clear_thinking keep:'all'` 显式要求服务端保留）。对自建 vLLM（无 1P 缓存保留机制）= 每轮实打实的额外 prefill token 开销。本项在「设置-通用-思考模式」下新增**二级开关**「将思考内容回传后端 API」：

- **关（默认/缺省）**：构造 API 请求体时剥离上轮 assistant 的 `thinking` / `redacted_thinking` block，不再作为上下文发给后端。
- **开（`sendThinkingHistory=true`）**：维持原行为（thinking 原样随 messages 回传）。
- **本地留存不变**：无论开关状态，本地会话历史（内存滚动 / jsonl 落盘 / 会话内回看渲染）完整保留 thinking。

设计意图：**升级后默认行为翻转**（thinking 不再回传省 token）。若发现模型质量回退，设置页打开二级开关或 `CC_HAHA_SEND_THINKING_HISTORY=1` 即恢复。

### 0.6.6 现状核对

- settings schema：`src/utils/settings/types.ts` 顶层 `.passthrough()`(:1174) 但文件校验 `.strict()`(:193) → 新字段须进 schema，否则被 strip 掉。范式 `alwaysThinkingEnabled`(:746-752)。
- thinking 工具：`src/utils/thinking.ts`（env 先例 `shouldSendExplicitDisabledThinking():220-222`）；`getSettingsWithErrors()` 已 import(:8)，返回 `{settings, errors}`。
- 主 API 咽喉点：`src/utils/messages.ts:2022` `normalizeMessagesForAPI(messages, tools, currentModel)`（3 参），尾部清理链 :2393-2472。`isThinkingBlock`:5026（匹配 `thinking`/`redacted_thinking`）；`stripSignatureBlocks`:5321 成熟模式可复用。
- 主路径挂载：`src/services/api/claude.ts:1417` 调用 + `getAPIContextManagement`:1837（局部 `hasThinking`:1721 另用于 temperature）。
- OpenAI 路线：`src/server/proxy/handler.ts:706` `roundTripReasoningContent`（DeepSeek/opencode.ai 明文回传）；`src/services/openaiAuth/fetch.ts:225` 响应方向 `preserveOpenAIReasoning`（请求方向 :61 保持 `true`）。
- **与老 fork 差异**：0.6.6 `normalizeMessagesForAPI` 是 **3 参**（本次加 options 成第 4 参）。0.6.6 有 `remoteBrowserPolicy.ts` 白名单（老 fork 无），新字段须同步 READ/WRITE 否则 H5 PUT 400 + 开关回弹（第六章坑）。0.6.6 `providers.test.ts` 有 2 个断言 DeepSeek `reasoning_content` 回传的用例（老 fork 无），门控默认关会让它们回归。

### 实施方案

1. **`src/utils/settings/types.ts`**：`alwaysThinkingEnabled` 后加 `sendThinkingHistory: z.boolean().optional().describe(...)`（缺省/absent=false=不回传）。
2. **`src/utils/thinking.ts`**：新增 `shouldSendThinkingToAPI(): boolean`——env `CC_HAHA_SEND_THINKING_HISTORY` 强开（`isEnvTruthy`，调试逃生门）→ `getSettingsWithErrors().settings.sendThinkingHistory === true`。
3. **`src/utils/messages.ts`**：`normalizeMessagesForAPI` 加第 4 参 `options?: { stripThinking?: boolean }`；在尾部清理链 `relocated` 之后、`filterOrphanedThinkingOnlyMessages` 之前插入 `withStrippedThinking = options?.stripThinking ? stripThinkingBlocksForAPI(relocated) : relocated`（顺序约束：thinking-only 剥空由 `ensureNonEmptyAssistantContent` 占位兜底，API 400 不变式全保持）。新增 `stripThinkingBlocksForAPI`——map assistant 消息 `content.filter(block => !isThinkingBlock(block))`，复用 `stripSignatureBlocks` 模式。其余旁路调用方（token 估算/compact 等）不传参 → **零行为变化**。
4. **`src/services/api/claude.ts`**：:1417 调用加第 4 参 `{ stripThinking: !shouldSendThinkingToAPI() }`（desktop/CLI/SDK 唯一 API 咽喉点）；`getAPIContextManagement` 改 `hasThinking: hasThinking && shouldSendThinkingToAPI()`（开关关时不发无意义的 `clear_thinking keep:'all'`；局部 `hasThinking` 仍用于 temperature 等）。
5. **`src/services/openaiAuth/fetch.ts`**：仅**响应方向** :225 `preserveOpenAIReasoning: shouldSendThinkingToAPI()`（**请求方向 :61 保持 `true`**，忠实老 fork）。
6. **`src/server/proxy/handler.ts`**：:706 `roundTripReasoningContent: (knownDeepSeekHost || reasoningProfile?.family === 'deepseek-v4') && shouldSendThinkingToAPI()`（其余 Chat 兼容商本就丢弃，不变）。
7. **`src/tools/ConfigTool/supportedSettings.ts`**：白名单加 `sendThinkingHistory`（`{source:'settings',type:'boolean',description:...}`，无 appStateKey）。
8. **`src/server/remoteBrowserPolicy.ts`**（0.6.6 特有）：`sendThinkingHistory` 加进 `READ_SETTINGS` 与 `WRITE_SETTINGS`（boolean 走默认校验）——H5 手机可读写（第六章坑）。
9. **桌面端**：`desktop/src/types/settings.ts` 加 `sendThinkingHistory?: boolean`；`settingsStore.ts` 加 `thinkingSendBack`（默认 false、读 `=== true`、setter 乐观 set→`updateUser({sendThinkingHistory})`→catch 回滚）；`GeneralSettings.tsx` 思考卡片主 checkbox 后插二级 checkbox（`thinkingEnabled &&` 门控）。
10. **i18n（5 语言）**：`settings.general.thinkingSendBackTitle` / `thinkingSendBackHint` 各 2 条（en/zh/zh-TW/jp/kr，插在 `thinkingHint` 后）。
11. **测试**：`thinking.test.ts` +4（`mock.module('../settings/settings.js')` 范式；absent=false / false=false / true=true / env 强开覆盖 false setting）；`messages.test.ts` +3（默认保留 / 剥离 thinking+redacted 且 text、tool_use 保留 / thinking-only 消息无错，**4 参调用** `(...,[],undefined,{stripThinking:true})`）；`providers.test.ts` 2 个 DeepSeek round-trip 用例内显式 `CC_HAHA_SEND_THINKING_HISTORY=1`（门控默认关会让它们回归，测试本意=验证 round-trip 路径）。

### 验证

- **server 全量零回归**：全量 `src/server` **3330 pass / 22 fail**，22 条失败名单与基线 worktree 逐条一致（含 2 条 DeepSeek round-trip 回归修好后）。`thinking.test.ts`+`messages.test.ts` 新增 7 用例全过（`thinking.test.ts` 既有 1 条 `shouldIncludeFirstPartyOnlyBetas` 环境依赖失败=基线既有，非本章引入）；`providers.test.ts` 142/142。
- **桌面**：`tsc -b` exit 0；`H5Settings`+`SettingsOutputStyle` 10/10；全量前端 vitest **6146 pass / 0 fail**（1df6bf70 修复后基线，零回归）。
- vite build → `App-Cl3KkIFE.js`（2201.04 kB，2.71s）。
- **行为矩阵**（对齐源§二十五）：Anthropic 关=剥离 + `clear_thinking` 不发 / 开=原样 + `keep:'all'`；OpenAI Chat DeepSeek 关=不发 `reasoning_content` / 开=发明文；Codex OAuth 关=不发加密信封 / 开=发；其余商本就丢弃；本地历史始终完整保留。
- **热更新**：开关在每次 API 请求时经 `getSettingsWithErrors` 读取（changeDetector 文件监听 + resetSettingsCache 既有机制），改完即对下一次请求生效，无需推控制消息。
- **Patch**：`modify/patches/thinking-switch.patch`（19 文件 619 行，含 3 测试文件）。**11 patch 全链 `git apply` 干净（仅 h5-settings-parity 既有 EOF 空白 warning）且 thinking-switch 19 文件逐字节等于工作树（0 差异）**。

---

## 九、H5 设置页与桌面端全 tab 对齐（放开浏览器「两 pill」围栏）（✅ 2026-09-24）

### 需求背景

0.6.6 的浏览器/H5 端设置页被「围栏」限制：`desktop/src/pages/Settings.tsx:28-30` 依据 `getDesktopHost().isDesktop` 分流，浏览器只渲染 `H5Settings`，而 `H5Settings.tsx` 原本只放 **2 个 pill**（模型配置 providers + 通用 general）。桌面端 `DesktopSettings` 则有 15 个主 tab + about 独立分组（共 16 个设置项）。用户要求 H5 在手机浏览器上能像桌面端一样**看到并使用全部设置项**（含通用 tab 换桌面完整版 GeneralSettings，接受浏览器端设置写回主机）。

### 0.6.6 现状核对

- 分流点：`Settings.tsx:29` `getDesktopHost().isDesktop ? <DesktopSettings/> : <H5Settings/>`（**不改**，H5 入口仍是 H5Settings）。
- `DesktopSettings`（`Settings.tsx:32-112`）：195px 侧栏 `TabButton` 列表 `:69-87`（15 主 + about 独立分组），内容 switch `:92-107`。
- 各 tab 组件浏览器安全性（Explore 审查结论）：多数自带 `getDesktopHost()` capabilities 降级——
  - Terminal：浏览器 `terminalApi.isAvailable()`(=`capabilities.terminal`)=false → 显示「需桌面端」EmptyState（`TerminalSettings.tsx:712`）。
  - Pet / ComputerUse / About：各自 `isDesktop`/capabilities 降级。
  - DirectoryPicker（Adapter/Mcp/Agent 共用）：浏览器走 `filesystemApi.browse` 浏览模式。
  - General：`setTheme` 只写 uiStore 不写回主机；dialogs/appMode/notifications 三处桌面 host 调用均有 capability 或 desktop-only 渲染守卫。
  - 数据全部走 `/api`（H5 可达）。
- `SettingsTab` union 已含 16 值（`uiStore.ts:233-249`）；`SettingsPill` 自带 `aria-pressed` + 渲染 `<button>`（`SettingsSection.tsx:101-129`）；i18n `settings.tab.*` 全部已存在。

### 实施方案

1. **提取 tab 常量供两端复用**（`Settings.tsx`）：新增模块级 `export const SETTINGS_TABS`（15 项 `{id, icon}` 数组，顺序与桌面 rail 一致）+ `export const SETTINGS_ABOUT_TAB = { id:'about', icon:'info' }`；`DesktopSettings` 侧栏改为遍历 `SETTINGS_TABS.map(...)`，about 独立分组保持不变。
2. **重写 `H5Settings.tsx`** 暴露与桌面端完全一致的 16 项（15 主 + about）：
   - `selected = pending ?? active`，pending 消费 effect（`setActiveSettingsTab(pending)` + `setPendingSettingsTab(null)`）。
   - 导航改为**横向可滚动 pill 条**（`overflow-x-auto` + 隐藏滚动条），适配窄屏；选中 pill 自动 `scrollIntoView`。
   - 内容区 16 分支与 `DesktopSettings:92-107` 一致（trace 用 `overflow-hidden` 全宽容器特殊分支），providers 保留 `<ProviderSettings browserMode />`，general 用桌面完整版 `<GeneralSettings />`。
   - skills/plugins 用本地 `H5SkillSettings`/`H5PluginSettings` 包装（selected 详情模式，`SettingsPageHeader` + List），与桌面 rail 的 SkillSettings/PluginSettings 同构。
3. **删除** `H5GeneralSettings.tsx`（仅旧 H5Settings 引用，被桌面 GeneralSettings 取代）；保留 `h5Settings.*` i18n key 不动。
4. **重写 `H5Settings.test.tsx`**：13 个页面组件 `vi.mock`（工厂函数，导出名与真实模块导出名一致），8 个用例——pill 数断言 **16**（15 主 + about）、导航到 Terminal/H5Access、4 个 ProviderSettings browserMode 原用例保留、Settings 路由 16 pill + provider 渲染。

### 验证

- **单测**：`H5Settings.test.tsx` 8/8 pass；desktop 全量 vitest 6137 pass（2 个既有失败：`providerModels.test.ts` 分组顺序、`MessagePayloadRetention.test.tsx` 5s 超时，均非本次触及）；`tsc -b` 0 错误。
- **重 build + 重启 7788 dev**：`cd desktop && node ./node_modules/vite/bin/vite.js build` → 新 bundle `index-B_ViiZEH.js`（旧 `index-ZWgLHPz_.js`）；线上 App chunk 含新横向导航特征 class（`overflow-x-auto border-b`）2 处，确认新 H5 设置页已打包并伺服。
- **patch 干净应用**：`modify/patches/h5-settings-parity.patch`（4 文件）经 `git apply --check` 验证可干净应用于 v0.6.6 基线 2f8d819d。
- **待手机实测**：192.168.10.140 开 `http://192.168.10.43:7788` 确认 16 项可见可切换（含 H5 访问里的 requireToken 开关）。

### 9.x H5 设置项 400/403 修复（remoteBrowser 白名单对齐，✅ 2026-09-27）

**问题**：H5 放开全 tab 后，手机（LAN public 源）操作通用/网络等设置项大面积 400「Unsupported General setting」，部分子路由 403。loopback curl 全 200 不暴露——因为 `classifyH5Request`（`src/server/h5AccessPolicy.ts`）仅对 public 源（`h5-browser`）走 `validateRemoteSettingsPatch` 白名单（`src/server/router.ts:68`），loopback 属 local-trusted 直连 `handleUserSettings`（宽松，只查 JSON）。

**根因**：`remoteBrowserPolicy.ts` 的 `READ_SETTINGS`/`WRITE_SETTINGS` 白名单是 H5 设置放开前的小集合（10/8 key），而桌面完整版 `GeneralSettings` 经 settingsStore 会写 16 个字段，其中 8 个不在 WRITE 白名单：`agentTeamsEnabled`/`autoDreamEnabled`/`skipWebFetchPreflight`/`desktopNotificationsEnabled`（bool）、`cleanupPeriodDays`（number 0–3650）、`webSearch`/`updateProxy`/`network`（对象）。另 `/api/settings` 子路由（output-styles、output-style、session-cleanup）不在 `remoteSettingsRouteAllowed`；`session-cleanup` 还被 `LOCAL_CREDENTIAL_ONLY_PATHS` 拦（设计=只许本地桌面进程调，用户拍板移除以完全对齐桌面）。

**修复**（7 文件，全 src/server/）：
1. `remoteBrowserPolicy.ts`：READ/WRITE 白名单 +8；新增形状校验器 `isValidWebSearch`（mode∈auto/anthropic/tavily/brave/disabled + 可选 apiKey 字符串）、`isValidUpdateProxy`（mode∈system/manual + url）、`isValidNetwork`（aiRequestTimeoutMs 30s–2^31ms + proxy.mode∈direct/system/manual + url）、`isValidCleanupPeriodDays`（int 0..3650）；`projectRemoteSettings` 重写为按 READ_SETTINGS 循环投影，4 个对象/数值字段校验后深拷贝（防 H5 刷新后对象值丢失回弹）；`remoteSettingsRouteAllowed` 扩：settings/user GET/PUT + output-styles GET + output-style PUT + session-cleanup POST。
2. `router.ts`：字段白名单校验+GET 投影只 gate `/api/settings/user`（`parts[2]==='user'`），子路由 body 交 handler 自校验。
3. `h5AccessPolicy.ts`：`LOCAL_CREDENTIAL_ONLY_PATHS` 清空（保留 gate 机制与注释）。
4–7. 测试同步：`remoteBrowserPolicy.test.ts` +12 路由白名单断言；`router.remoteBrowser.test.ts` +子路由用例（200/403）；`h5-access-policy.test.ts` 反转 session-cleanup 断言（仍保留 /api/h5-access 本地限定）；`h5-access-auth.test.ts` preflight 403 列表去掉 session-cleanup。

**验证**：live 7788 LAN（192.168.10.43 + H5 token）——8 字段 PUT 全 200、GET/PUT output-style(s) 200、POST session-cleanup 200、错误方法 403、`/project`/`/cli-launcher`/`/permission-mode` 仍 403、GET /user 投影回读 6 新字段全在、坏形状（mode:'bogus'/3651/-1）仍 400；3 测试文件 13/13；`src/server` 全量零回归。

**patch**：`modify/patches/h5-settings-whitelist.patch`（7 文件 357 行，链位 12，基线 6d4fd126）。

---

## 十、本地开发模式注意事项（✅ 2026-09-24 跑通）

> 0.6.6 基座的本地开发模式（sidecar server 直接跑源码）已跑通，本节固化关键节点，避免遗失。
> 目的：开发模式与在用的桌面端（`/opt/Claude Code Haha`，端口 8877）完全隔离，互不干扰。

### 10.1 环境准备

- 依赖：仓库根 `bun install` + `cd desktop && bun install`（bun 位于 `~/.bun/bin/bun`）。
- H5 静态页：sidecar 从 `CLAUDE_H5_DIST_DIR`（或 cwd 下 `desktop/dist`）读静态资源，**必须先构建**：
  `cd desktop && bun run build`（含 preview-agent 构建 + tsc -b + vite build，产物在 `desktop/dist/`）。

### 10.2 数据/配置复制（与桌面端隔离）

- 数据根目录规则：`$CLAUDE_CONFIG_DIR/cc-haha/`（代码内 `path.join(configDir, 'cc-haha', ...)`，`configDir = process.env.CLAUDE_CONFIG_DIR || ~/.claude`）。
  - 桌面端在用：`~/.claude/cc-haha`（210M，db/ 占 209M：index-v1.sqlite 78M + search-index-v1.sqlite 110M 等）。
- 复制方法（dev 用独立副本）：
  ```bash
  mkdir -p /home/zeaxion/cc-haha-dev
  cp -a ~/.claude/cc-haha /home/zeaxion/cc-haha-dev/cc-haha
  ```
- dev 副本 `settings.json` 改 `h5Access.fixedPort: 8877 → 7788`（`publicBaseUrl` 保持 plain-lan `http://192.168.10.43` 即可，0.6.6 会自动用实际绑定端口刷新，`refreshLanPublicBaseUrlPort`）。
- 复制时桌面端仍在跑：SQLite 的 `-wal`/`-shm` 也一并复制，dev 副本索引状态会报 `LOCAL_INDEX_DISCOVERY_INCOMPLETE`（索引内 transcript 路径仍指向原 home 下的文件，dev 副本里没有），**属正常现象**；SQLite 库本体完好，数据可读写。

### 10.3 启动命令（端口 7788，对外 0.0.0.0）

```bash
cd /home/zeaxion/myproject/cchaha-06scode
CLAUDE_CONFIG_DIR=/home/zeaxion/cc-haha-dev \
CLAUDE_H5_DIST_DIR=/home/zeaxion/myproject/cchaha-06scode/desktop/dist \
~/.bun/bin/bun run desktop/sidecars/claude-sidecar.ts server \
  --app-root /home/zeaxion/myproject/cchaha-06scode \
  --host 0.0.0.0 --port 7788
```

关键点：
- **`--app-root` 必填**：sidecar launcher（`desktop/sidecars/launcherRouting.ts` 的 `parseLauncherArgs`）缺省会抛 `Missing --app-root`；dev 模式指向仓库根即可（preload.ts 只设 MACRO 并 chdir 到 `CALLER_DIR`，不依赖 app-root 是 asar）。
- 端口/绑定：`--host`/`--port` 在 `src/server/index.ts` `resolveServerOptions` 解析（env `SERVER_HOST`/`SERVER_PORT` 兜底，默认 127.0.0.1:3456）。
- dev 模式下会话 CLI 子进程：`resolveClaudeCliLauncher`（`src/utils/desktopBundledCli.ts`）因 execPath 是 bun 而非 sidecar 二进制而返回 null，走 `bin/claude-haha` 脚本路径（内部再 spawn bun 跑 `src/entrypoints/cli.tsx`）——所以 CLI 能力无需编译 sidecar 二进制。

### 10.4 H5「允许所有 IP」的 0.6.6 语义

- 0.6.6 的 H5 鉴权**没有** `requireToken` 字段（那是旧§二本地优化，0.6.6 `normalizeStoredSettings` 会静默丢弃该字段）；门槛只有 H5 token。
- 鉴权策略（`src/server/h5AccessPolicy.ts`）：
  - 外部 IP 浏览器请求 → `classify==='h5-browser'`，能力路径（`/api/`、`/ws/`、`/proxy/`、`/local-file/`、`/preview-fs/`）需 Bearer H5 token；
  - loopback（127.0.0.1/::1/localhost，且无代理头、URL hostname 也是 loopback）→ `local-trusted`，免 token；
  - 静态页（`/`、`/assets/`）不鉴权，任何人可打开首页。
- 因此「允许 0.0.0.0/0」= `--host 0.0.0.0` + `h5Access.enabled: true` + 有效 token；外部 IP 带 token 即可全量访问，**无需任何私网豁免代码**（旧§二的 requireToken 开关/私网豁免是叠加在此之上的新开关，见第一章）。
- dev 复用桌面端同一 token：`h5_H7kDPNb-KkhMnULdmQ-B0eoAd8ey-Pcc9PhtcpbeSUQ`。

### 10.5 验证结果（2026-09-24）

| 验证点 | 结果 |
|--------|------|
| 启动日志 | `[Server] Claude Code API server running at http://0.0.0.0:7788` |
| 静态首页（外部 IP，无 token） | 200（index.html 11133 bytes） |
| `/api/sessions` 外部 IP 无 token | 401 `Missing H5 access token` |
| `/api/sessions` 外部 IP 带 token | 200，索引 `discovered:23/indexed:23`，databaseBytes 78561280 |
| `/api/sessions` loopback 无 token | 200（local-trusted，符合策略） |
| `/api/h5-access`（控制面，H5 token） | 403 `can only be changed from the local desktop app`（控制面需 desktop process token，符合设计） |
| 与桌面端共存 | 8877（桌面）与 7788（dev）同时 LISTEN，数据目录独立互不干扰 |

### 10.6 注意事项 / 坑位

- **改过 H5 前端源码后必须重 build 并重启 sidecar**：sidecar 直接伺服 `desktop/dist/` 静态产物，源码改动不会热更。2026-09-24 实例：`desktopRuntime.ts` 16:09 加入免 token 直连逻辑，dist 还是 15:23 的旧产物 → LAN 设备（192.168.10.140）访问仍弹「需要访问令牌」；重跑 `cd desktop && node ./node_modules/vite/bin/vite.js build` + kill/重启 sidecar 后解决。判断 bundle 是否过期：比对 `dist/index.html` mtime 与 `desktop/src/` 改动文件 mtime。
- dev 副本与桌面端**独立写库**：在 dev 上做的会话/设置改动不会回到 `~/.claude/cc-haha`，反之亦然；需要回灌时手动合并。
- 改 `src/*.ts` 后 sidecar 需**重启**才生效（bun 直接跑源码无热更）；H5 前端改动需重跑 `desktop && bun run build`。
- 停 dev：直接 kill sidecar 进程；`~/.cc-haha-dev` 副本可随时删掉重拷。
- `LOCAL_INDEX_DISCOVERY_INCOMPLETE` 出现时列表接口 `total` 可能为 0（列表作用域=活跃会话索引），但索引计数正常；若需要完整列表，可在 dev 副本上重建 local index 或从桌面端同步。

---

## 十一、H5 悬浮快捷入口（任务列表 / 文件浏览 / 审查）（源参考：旧§5.2 移动端 FAB，⬜ 待实施）

**需求**：移动端（H5 手机浏览器）会话页右上角缺少桌面端的任务列表 / 文件浏览 / 审查入口（0.6.6 现状：`AppShell.tsx:406` 移动端不渲染 TabBar；三面板均硬编码 `!isMobileLayout` 禁用）。需为移动端提供悬浮（FAB）快捷入口，点击展开菜单打开对应面板，面板以全屏 overlay 呈现。

**参考（旧 fork §5.2 MobileQuickActions，2026-08 已实施，模式可复用）**：
- 旧实现 `desktop/src/components/chat/MobileQuickActions.tsx`：圆形 FAB（`add` 图标）→ 点击横向展开 3 个带图标+文字按钮（任务列表 `assignment` / 终端 `terminal` / 文件浏览 `folder`）；点外部或再点 FAB 收起（`useDismissable`）；FAB `absolute` 定位在 ChatInput 右上角半重叠，仅移动端渲染。
- 动作路由：任务列表 → `useActivityPanelStore.open(activeTabId)`；文件浏览 → `workspaceStore` setMode('workspace')+openPanel；面板移动端全屏 overlay（fixed 全屏 + slide-in + 顶部标题栏 + 关闭按钮），去掉面板的 `!isMobileLayout` 硬禁。
- 旧版含横屏适配（顶栏缩高、输入框缩小、chip 归位 toolbar、MobileBottomSheet 缩放、FAB pointer-events 修复等）——本次按需取舍，先做竖屏核心，横屏适配视验证情况跟进。

**与旧版的差异（本次范围）**：
- 入口 3 项 = **任务列表 / 文件浏览 / 审查**（旧版是 任务列表/终端/文件浏览；终端已有独立设置 tab 入口 + H5 终端桥接，本次以「审查」替代——审查 = 文件浏览面板的 review tab，`workspaceReviewStore`，i18n `workspace.reviewTabTitle`「审查」）。
- 0.6.6 组件名/结构待调研确认（旧版基于 2026-08 fork，0.6.6 可能已重构：ChatInput 容器、store 名、panel 组件均须以 0.6.6 实际代码为准）。

**待办**：
- [ ] 调研 0.6.6 现状（面板 store/组件、移动端布局判定、ActiveSession 结构）
- [ ] 实施 MobileQuickActions + 面板全屏 overlay
- [ ] i18n 5 语言
- [ ] 验证 + patch `h5-mobile-quick-actions.patch`
