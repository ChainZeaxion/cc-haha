# pr-1 — H5 远程访问与移动端支持

## 功能域概述

让手机浏览器（H5）通过局域网/公网访问 cc-haha 时获得接近桌面端的能力：H5 访问令牌开关与私网免令牌、H5 设置页与桌面端全 tab 对齐、H5 终端桥接（真实 PTY 走 WebSocket）、移动端悬浮快捷入口（任务列表/终端/文件浏览/审查），以及移动端可打开技能市场、计划任务、子代理运行记录等页面。另含本地 dev 实例的额外索引根（`CC_HAHA_EXTRA_PROJECT_ROOTS`）与会话列表多根校验，保证 dev/H5 场景下真实项目的会话能被完整索引和列出。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. H5「需要访问令牌」开关 + loopback/私网/ULA 免令牌（链位 1，`01-h5-require-token.patch`）

- 需求背景：0.5.3 旧实现有 H5 令牌开关与私网豁免，0.6.6 基座无 `requireToken` 字段（`normalizeStoredSettings` 静默丢弃），且私网来源（LAN IP 浏览器）不被豁免、桌面前端 `requiresH5AuthForServerUrl` 只豁免 loopback，导致 LAN 手机打开 H5 仍弹 token 输入。与用户确认最终语义：默认 `requireToken: false` = 全免 token；开启时 loopback + RFC1918 + IPv6 ULA（fc00::/7）按 socket 源地址（`server.requestIP()`）免 token，公网需 Bearer token。
- 方案：
  - `h5AccessService.ts` 加 `requireToken: boolean`（默认 false，`=== true` 解析）；`api/h5-access.ts` PUT 透传。
  - `h5AccessPolicy.ts` 新增 `isPrivateIPv4Source` 与 `isTrustedLocalSourceHost`（剥 bracket/`::ffff:` 前缀 → loopback → ULA 正则 → 私网 IPv4），`shouldRequireH5Token` 加必填 `requireToken` 参数。
  - 桌面端 `desktopRuntime.ts` 加 tokenless 快速路径：health 后先探 `/api/status`，仅 401(missing-token) 才落 token 输入流程。
  - `H5AccessSettings.tsx` enabled 行下新增 checkbox，即时生效（非 draft/save）；i18n 5 语言各 2 key；settingsStore/api/types 同步加字段。
- 验证：服务端 h5-access-policy 31/31 + h5-access-service 28/28；桌面 generalSettings 131、settingsStore 64、desktopRuntime 30/30（含 LAN 免 token 直连新用例）；dev 7788 live 在 LAN/loopback/模拟公网 XFF 下按 requireToken 两种取值全部符合预期，控制面 PUT 落盘正确。真实设备回归：192.168.10.140 手机免 token 直连成功（此前失败根因是 dist bundle 过期）。

### 2. H5 选「自动模式」持续 400 修复（链位 2，`02-h5-auto-mode-optin.patch`，对应文档 1.1）

- 需求背景：H5（手机浏览器）权限审批选「自动模式」点确认后 toast 持续报 400。根因：`acceptAutoModeOptIn()` 走 `PUT /api/settings/user {skipAutoPermissionPrompt:true}`，H5 请求被分类为 `h5-browser` 后走 `validateRemoteSettingsPatch` 白名单校验，而 `WRITE_SETTINGS` 白名单 5 个字段不含 `skipAutoPermissionPrompt`（只读不可写）→ 400 `Unsupported General setting`；桌面端 local-trusted 不走此校验故仅 H5 报错。
- 方案：`src/server/remoteBrowserPolicy.ts` 的 `WRITE_SETTINGS` 白名单加入 `skipAutoPermissionPrompt`（boolean，复用既有 `typeof value === 'boolean'` 末行校验），风险等级与其它白名单布尔字段一致。
- 验证：`router.remoteBrowser.test.ts` 合法 patch 用例加该字段并补「单独 PUT 200+落盘」「字符串 `'true'` 仍 400」断言，8/8 pass；dev 7788 live（LAN 视角）修复前 400 → 修复后 200 且 GET 读回落盘正确。

### 3. H5 设置页与桌面端全 tab 对齐（链位 4，`04-h5-settings-parity.patch`）

- 需求背景：0.6.6 浏览器端设置页被「围栏」限制——`Settings.tsx` 按 `getDesktopHost().isDesktop` 分流，浏览器只渲染 `H5Settings`，而它原本只有 2 个 pill（providers + general）；桌面端有 15 个主 tab + about 共 16 项。用户要求 H5 在手机浏览器上像桌面端一样看到并使用全部设置项（含通用 tab 换桌面完整版 GeneralSettings，接受浏览器端设置写回主机）。
- 方案：
  - `Settings.tsx` 提取模块级 `SETTINGS_TABS`（15 项）+ `SETTINGS_ABOUT_TAB` 常量，桌面 rail 改遍历复用。
  - 重写 `H5Settings.tsx`：与桌面一致的 16 项，导航改横向可滚动 pill 条（`overflow-x-auto`，窄屏适配，选中项 `scrollIntoView`）；内容区 16 分支与桌面 switch 一致，providers 保留 `browserMode`，general 用桌面完整版 `GeneralSettings`，skills/plugins 用本地包装同构渲染。
  - 删除 `H5GeneralSettings.tsx`（被桌面 GeneralSettings 取代）；重写 `H5Settings.test.tsx`（13 个组件 mock，8 用例，pill 数断言 16）。
- 验证：`H5Settings.test.tsx` 8/8；desktop 全量 vitest 6137 pass（仅 2 条与本次无关的既有失败）；`tsc -b` 0 错误；重 build 后线上 App chunk 含新横向导航特征 class，确认新设置页已打包伺服；patch 对 v0.6.6 基线 `git apply --check` 干净。

### 4. H5 终端桥接：手机浏览器用真实 PTY 终端（链位 5，`05-h5-terminal-bridge.patch`，对应文档 1.2）

- 需求背景：终端能力原本桌面独占（`browserHost.capabilities.terminal=false`，浏览器端只显示「unavailable」空态）。目标：H5 手机浏览器也能起真实 PTY 终端，默认工作目录跟随当前会话 workDir，功能对齐（shell 选择 + bash 路径设置）。
- 方案：
  - 服务端新增 `terminalService.ts`（~836 行，镜像 electron 侧 shell/cwd/env/事件逻辑，注入 `ptyFactory`，15s 断连宽限、`/api/terminal/bash-path` REST）；WS 通道 `handler.ts` 扩 `'terminal'` channel（`terminal_spawn/write/resize/kill` ↔ `terminal_spawned/output/exited/sync`）；`index.ts` 在 `/ws/` 之前插 `/ws/terminal` 字面路由；`remoteBrowserPolicy.ts` 放行 `desktopTerminal` 设置键。
  - 前端新增 `terminalWs.ts`（独立 WS 客户端，指数退避重连）；`browserHost.ts` capabilities.terminal 改 true 并改 WS 实现；`H5Settings.tsx` 渲染 `<H5TerminalSettings/>`（cwd 取 `activeSession?.workDir ?? projectRoot`）；xterm 层 `TerminalSettings.tsx` 零改动。
  - 关键 Bug 修复：Bun 下 node-pty 的 `tty.ReadStream` 首次 EAGAIN 即关流致 PTY ~12ms SIGHUP 秒退 → 绕过 UnixTerminal 直接调原生 `pty.fork`，master fd 用异步 `fs.read` 非阻塞读；另修 `stopSession` 竞态（先删 map 致 exit 帧丢失）。
  - Bug 2：LAN IP 是非安全上下文，`crypto.randomUUID` undefined 致开终端报错 → 加 `createTerminalRequestId()` 回退 id 生成。
- 验证：`terminal-service.test.ts` 11/11（FakePty 注入）、`websocket-handler.test.ts` 103/103；前端 `tsc -b` 0 错、vitest terminal+contract 12/12；dev 7788 live（LAN 带 H5 token）spawn→echo→resize→kill→`terminal_exited` 帧全链路通过；5 patch 全链 `git apply` 干净且与当时工作树逐字节一致。

### 5. H5 悬浮快捷入口（任务列表/终端/文件浏览/审查）（链位 13，`13-h5-mobile-quick-actions.patch`）

- 需求背景：移动端（H5 手机浏览器）会话页缺少桌面端的任务列表/终端/文件浏览/审查入口（0.6.6 现状：移动端不渲染 TabBar，三面板均硬编码 `!isMobileLayout` 禁用）。需悬浮（FAB）快捷入口，点击展开菜单、面板以全屏 overlay 呈现。参考旧 fork §5.2 的 MobileQuickActions 模式，本次入口从 3 项扩为 4 项（新增「审查」=文件浏览面板的 review tab）。
- 方案：
  - 新增 `MobileQuickActions.tsx`：FAB（`bolt` 图标，open 时 rotate-45）点击横向展开 4 个胶囊按钮（任务列表/终端/文件浏览/审查），`useDismissable` 点外部/Esc 收起，i18n 5 语言 5 key。
  - `ActiveSession.tsx`：本地 `mobileWorkspaceOpen` state（后台 `openTarget` 不弹 overlay，仅 FAB 显式点按才弹）；移动端全屏 overlay（`fixed inset-0`，顶栏标题+关闭按钮，内容 `WorkspaceSurface dock="side"`）；终端/文件/审查共用同一 overlay，由 `openWorkspaceTarget` 的 `target.kind`（`file`/`review`/`terminal`）区分，终端 tab 走 H5 终端桥接 WS。
- 验证：新增 `MobileQuickActions.test.tsx` 3 用例 + `ActiveSession.test.tsx` 新用例（overlay 开/关、终端 tab）；`tsc -b` 0 错，受影响 58/58，全量前端 vitest 6150 pass/0 fail（零回归）；live 7788 iPhone 14（390×844）全验证：4 项展开、文件树/review tab/终端 xterm（WS spawn 后显示 zsh prompt）均正常，关闭后 overlay 卸载。

### 6. H5/移动端支持打开计划任务（定时任务）页（链位 15，`15-h5-mobile-scheduled.patch`）

- 需求背景：用户 verbatim：「再把计划任务也给移动端访问H5打开适配」。计划任务页本身纯 `taskStore`+HTTP 无桌面宿主依赖，但被两处拦截：`Sidebar.tsx` 定时任务 NavItem 包在 `{!isMobile}` 内（移动端抽屉无入口）；`AppShell.tsx:275` 移动端 effect 早退条件不含 scheduled（scheduled tab 被强制踢回会话）。
- 方案：`Sidebar.tsx` NavItem 移出 `!isMobile` 包裹；`AppShell.tsx` 早退条件加 `activeTab?.type === 'scheduled'` + mobile-session-header 加 scheduled 标题分支；`ScheduledTasks.tsx` 内容容器 `px-11` → `px-4 lg:px-11` 移动端响应式；同步更新 `Sidebar.test.tsx` 中移动端导航断言。
- 验证：tsc 0 错；Sidebar/AppShell/ContentRouter 135/135；全量前端 vitest 仅 2 条既有 MessageList flaky（单跑全过）；live 7788 iPhone 14：抽屉出现「定时任务」→点击后页头/新建任务按钮/桌面在线提示条均正常；18 链全验证干净。

### 7. H5/移动端技能市场页 header 布局适配（链位 17，`17-h5-mobile-market-layout.patch`）

- 需求背景：用户 verbatim：「主要是技能市场，该页面内大标题下面的文字排成了9行，这相当不合理。」390px 下 `MarketHome` header（`flex flex-wrap`：56px 图标 + 标题列 + 228px SourceStatusBar + 146px 按钮）标题列只剩 16px，副标题折 15 行、header 总高 508px≈屏幕 60%。
- 方案：`MarketHome.tsx` 右侧集群容器加 `max-lg:items-start max-lg:basis-full`——窄屏（<1024px）换行独占一行，标题列拿满剩余宽度；桌面端 `max-lg:` 不生效布局零变化。纯响应式 CSS，无新 i18n/逻辑改动。
- 验证：live 7788 移动端 390×844：副标题 15 行→2 行，header 508px→158px，信息全保留；桌面 1280px 零变化；tsc 0 错，市场+页面 vitest 872/872，全量 12300 pass/0 fail（零回归）。

### 8. H5 打不开子代理运行记录：移动端 tab 守卫白名单补 subagent/team-member（链位 34，`34-h5-mobile-run-records.patch`）

- 需求背景：用户 verbatim：「H5访问的打不开子代理运行记录。无法查看子代理在运行中的情况。」根因：`AppShell.tsx` 有仅移动端（`isMobileShell`）的守卫 effect——activeTab 不属于 `session`/`settings`/`market`/`scheduled` 白名单就强制切回聊天 tab，而 `subagent`/`team-member` 从未登记（该白名单随移动端逐页支持扩展，market/scheduled 是各自章节补进去的，run 记录页漏了）；桌面端该 effect 不执行故完全复现不出，且无任何报错、只表现「打不开」。
- 方案：`AppShell.tsx` 守卫白名单补 `subagent`/`team-member` 并加注释说明 run 记录页本就是移动端可达目的地（`ContentRouter` 渲染、两页有移动端布局）；`AppShell.test.tsx` 加 2 用例：subagent 时不得 `setActiveTab`（正向）+ terminal 仍必须回落聊天 tab（反向钉住边界，防白名单过度放宽）。
- 验证：`AppShell.test.tsx` 24/24；`tsc --noEmit` 0 错；vite build 后 grep 产物 bundle 确认守卫含 `"subagent"===` 与 `"team-member"===` 分支；7788 dev sidecar（`CLAUDE_H5_DIST_DIR` 指仓库 dist）重启后 H5 实测可达。经验：「只有 H5 坏、桌面正常」优先查 `isMobileShell` 分支；此后新增移动端页面须把「守卫白名单」列为固定核对项。

### 9. 额外索引根 `CC_HAHA_EXTRA_PROJECT_ROOTS`（链位 46，`46-local-index-extra-project-roots.patch`，文档「十」补记）

- 需求背景：本地 dev 实例用自己的 `CLAUDE_CONFIG_DIR`（与桌面端 8877 隔离），会话本地索引的「发现根」随 `CLAUDE_CONFIG_DIR` 变成 dev 自己的 `projects/` 目录，真实项目目录下的会话在 dev/H5 上永不出现（dev 列表原本只含 dev 自己的 2 条会话）。
- 方案：localIndex `config.ts`/`coordinator.ts` 支持 `CC_HAHA_EXTRA_PROJECT_ROOTS` 环境变量——在默认发现根之外额外索引真实 `~/.claude/projects/` 等根，dev 实例可同时看到真实目录的会话（实测 2 → 84 条）。刻意不改共享 `CLAUDE_CONFIG_DIR`（两进程共写同一索引 DB，rebuild 会清空生产）。
- 验证：dev 7788 实例实测会话列表从 2 条恢复到 84 条；含 `coordinator.test.ts` 单测；patch 对 0.6.6 基线干净应用。

### 10. 会话列表逐行校验改按全部索引根（链位 48，`48-session-list-multi-root-validation.patch`，文档「十」补记二）

- 需求背景：多根索引后，会话列表的逐行校验只认本配置目录的根，来自额外根的行被判越界并被 `catch` 静默丢弃——表现为 `total` 报得对、行数却只剩 2，侧边栏分组也丢失。
- 方案：`sessionService.ts` 的逐行越界校验改为按全部索引根（默认根 + `CC_HAHA_EXTRA_PROJECT_ROOTS`）判定，额外根的行不再被丢弃（1 文件约 70 增）。
- 验证：dev 7788 实测平铺列表 2 → 84、侧边栏分组恢复；与链位 46 同属「十」补记，两者配套（48 依赖 46 的多根机制）。

## 验证口径（组级）

- 服务端（bun test，0.6.6 基线）：`h5-access-policy`/`h5-access-service`/`h5-access-auth`、`terminal-service`、`websocket-handler`、`router.remoteBrowser`、`localIndex/coordinator` 相关测试全绿（各章节实施时记录均为全 pass，src/server 零回归口径）。
- 桌面端：`tsc -b` exit 0；vitest 覆盖 `H5Settings`/`generalSettings`/`settingsStore`/`desktopRuntime`/`MobileQuickActions`/`ActiveSession`/`AppShell`/`Sidebar`/`contract`/`terminal`；全量前端 vitest 以实施时点基线零回归为口径（如 6150 pass/0 fail、12300 pass/0 fail 等，随链推进数字递增）。
- live 口径：dev 7788（`--host 0.0.0.0`，`CLAUDE_H5_DIST_DIR` 指向仓库 `desktop/dist`，前端改动须重 build + 重启 sidecar 才生效）+ LAN 真机（192.168.10.140 / iPhone 14 390×844）实测 H5 访问、终端、设置 tab、悬浮入口、市场/定时任务/子代理运行记录页面。
- 补丁口径：各 patch 均在干净 0.6.6 基线（2f8d819d / 068b3ebd 链终态）上 `git apply` 失败 0，且覆盖文件与当时工作树逐字节一致（全链 worktree 重放验证）。

## 与其他组的关系

- 依赖/被依赖：本组 patch 直接改动 H5 访问鉴权（`h5AccessPolicy`/`remoteBrowserPolicy`/`h5AccessService`）、终端（`terminalService`/`terminalWs`/`browserHost`）、移动端 shell（`AppShell`/`Sidebar`/`ActiveSession`）与本地索引（`localIndex`/`sessionService`）。manifest 文件清单中大量「依赖补齐」文件（如 `chatStore.ts`、`TpsIndicator.tsx`/`tpsMeter.ts`/`tpsCalibration.ts`、`SessionActivityPanel.tsx`、`DownloadReferencesCard.tsx`、`sessionUsageMetrics.ts`、`subagents.ts`、`sessionExport.ts` 等）是链内被其他功能组（TPS 速率引擎、子代理用量、文件下载等）改动/新增的传递依赖，随本组 patch 一并带入——上游合入时这些文件可能与其他 PR 的改动重叠，需按链序（本组链位 1/2/4/5/13/15/17/34/46/48）在完整链语境下核对。
- 链位 48（多根列表校验）依赖链位 46（`CC_HAHA_EXTRA_PROJECT_ROOTS`）的多根机制，两者必须同组提交（本组已同含）。
- 移动端各页面开放（市场/定时任务/子代理运行记录）共享 `AppShell.tsx` 的 `isMobileShell` 守卫白名单这一隐性登记表，后续其他组新增移动端可达页面时需同步登记。

## 风险与备注

- 上游冲突风险文件（manifest ⚠️ 标注，上游 main 也改过）：
  - `desktop/src/__tests__/generalSettings.test.tsx`
  - `desktop/src/components/chat/MessageList.tsx`
  - `desktop/src/i18n/locales/en.ts`、`jp.ts`、`kr.ts`、`zh-TW.ts`、`zh.ts`（i18n 5 语言均高频改动区）
  - `desktop/src/pages/ActiveSession.test.tsx`、`ActiveSession.tsx`
  - `desktop/src/stores/chatStore.ts`
  - `desktop/src/types/chat.ts`
  - `package.json`
  - `src/server/__tests__/h5-access-auth.test.ts`
  - `src/server/index.ts`
  - `src/server/services/sessionService.ts`
  - `src/server/ws/handler.ts`
- 备注：
  - `05-h5-terminal-bridge` 体量最大（~1644 增，4 个新文件带 `new file mode`），且含 Bun/node-pty 兼容的特殊 pty 读取实现，review 时需说明「直调 `pty.fork` + 异步 fs.read」是绕 Bun 下 node-pty EAGAIN 关流 bug 的有意选择，非简化。
  - `h5-require-token` 与 `h5-terminal-bridge` 对 `src/server/index.ts` 的改动块不相交（前者为 `serverFetch` 抽取 + unix-socket 测试设施，后者为 `/ws/terminal` 路由），但同文件合入仍建议相邻排序。
  - H5 前端改动生效依赖重 build `desktop/dist`（sidecar 伺服静态产物不热更），上游若改静态伺服路径需同步检查。
  - 本组文档章节还涉及「十」（本地开发模式 10.1-10.6）与「九.x」（remoteBrowser 白名单 400/403 修复）；其中九.x 对应 patch（`h5-settings-whitelist.patch`）与「十四」对应 patch（`h5-mobile-market.patch`，market 上移动端的入口/守卫改动）未列入本组 patch 清单，若上游需要 H5 全 tab 设置写回的完整白名单对齐，请与对应组协调。
