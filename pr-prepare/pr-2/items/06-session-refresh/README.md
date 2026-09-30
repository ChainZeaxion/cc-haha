# 06-session-refresh — 会话刷新按钮（授权/提问卡住软刷新规避）（链位 6，06-session-refresh.patch）

> 功能组：pr-2 — 会话基础功能（导出/刷新/禁止更新/思考开关）（pr-prepare/pr-2/）
> 链位 6，patch `06-session-refresh.patch`（本目录）

- 需求背景：会话中需要 can_use_tool 授权或 AskUserQuestion 问答时，有概率卡在「准备工具」不弹对话框——根因是 WS 投递链路在特定条件下丢消息（`clients.size===0` 或 transcript epoch 不匹配时 return），而服务端 `pendingPermissionRequests` 总是完整记录，刷新重连后服务端会重放 permission 消息即可恢复。方案是提供手动「刷新会话」软刷新按钮，无需整页刷新。
- 方案（纯前端，利用服务端既有重放机制，无需服务端改动）：
  - handler（桌面/移动端各一份同逻辑）：`useState refreshingSession` 防重入；`disconnectSession(id)` → 等 120ms → `connectToSession(id)`（触发服务端 `replayPendingPermissionRequests` + snapshot）→ `await reloadHistory(id)`（经 `GET /api/sessions/:id/messages?mode=full` 补回 CLI 已写入的 AskUserQuestion tool_use）。
  - 桌面：`ActiveSession.tsx` 加 `handleManualRefresh`，按钮挂 `SessionChatHeader actions`（ghost 小按钮、refresh 图标、刷新中 `animate-spin`）。
  - 移动端：`AppShell.tsx` 的 `mobile-session-header` 尾部加 `IconButton`（`isActiveChatTab` 门控，仅 chat tab 渲染）。
  - i18n 新增 `chat.refreshSession` 5 语言。
- 验证：`tsc -b` 0；vitest `AppShell`+`ActiveSession` 54/54 pass；vite build 成功，dev 7788 会话页标题栏/移动端 header 可见刷新按钮。
