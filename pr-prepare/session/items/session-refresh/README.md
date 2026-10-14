# session-refresh — 会话刷新（原链位 6）

> 功能主题：`session` — 会话及相关优化（会话基础 + 文件下载 + 大会话加载/传输性能 + 打开提速）（`pr-prepare/session/`）｜ PR 分支 `session-related-optimizations`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/session/session-refresh-patch1.patch`（2 文件 +183−7）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 6 | `session-refresh` | 三 会话刷新按钮 |

## 明细

### 原链位 6 — `session-refresh`

- 需求背景：会话中需要 can_use_tool 授权或 AskUserQuestion 问答时，有概率卡在「准备工具」不弹对话框——根因是 WS 投递链路在特定条件下丢消息（`clients.size===0` 或 transcript epoch 不匹配时 return），而服务端 `pendingPermissionRequests` 总是完整记录，刷新重连后服务端会重放 permission 消息即可恢复。方案是提供手动「刷新会话」软刷新按钮，无需整页刷新。
- 方案（纯前端，利用服务端既有重放机制，无需服务端改动）：
  - handler（桌面/移动端各一份同逻辑）：`useState refreshingSession` 防重入；`disconnectSession(id)` → 等 120ms → `connectToSession(id)`（触发服务端 `replayPendingPermissionRequests` + snapshot）→ `await reloadHistory(id)`（经 `GET /api/sessions/:id/messages?mode=full` 补回 CLI 已写入的 AskUserQuestion tool_use）。
  - 桌面：`ActiveSession.tsx` 加 `handleManualRefresh`，按钮挂 `SessionChatHeader actions`（ghost 小按钮、refresh 图标、刷新中 `animate-spin`）。
  - 移动端：`AppShell.tsx` 的 `mobile-session-header` 尾部加 `IconButton`（`isActiveChatTab` 门控，仅 chat tab 渲染）。
  - i18n 新增 `chat.refreshSession` 5 语言。
- 验证：`tsc -b` 0；vitest `AppShell`+`ActiveSession` 54/54 pass；vite build 成功，dev 7788 会话页标题栏/移动端 header 可见刷新按钮。
