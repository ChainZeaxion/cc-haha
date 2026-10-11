# thinking-subagent — 思考计时与子代理用量

- PR 分支：`thinking-subagent`｜主题目录：`pr-prepare/thinking-subagent/`
- 上游文档章节：二十一/二十六/二十八.2/二十五
- 单一真相源 patch 目录：`modify/patches/thinking-subagent/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；72 文件 +7850−255）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `thinking-subagent-thinking-tool-timing` | `thinking-subagent-thinking-tool-timing-patch1.patch` | 21,28,29,39,41,43,49,61 | +3346−139 | 54 |
| `thinking-subagent-split-no-double-count` | `thinking-subagent-split-no-double-count-patch1.patch` | 52 | +166−14 | 4 |
| `thinking-subagent-subagent-usage-cross-client` | `thinking-subagent-subagent-usage-cross-client-patch1.patch` | 63 | +1067−39 | 11 |

## 文件清单（组补丁含 72 文件）

### 本主题优化项直接改动（62）

- `desktop/src/api/sessions.ts`
- `desktop/src/api/subagents.ts`
- `desktop/src/components/activity/SessionActivityPanel.test.tsx`
- `desktop/src/components/activity/SessionActivityPanel.tsx`
- `desktop/src/components/activity/sessionActivityModel.ts`
- `desktop/src/components/chat/ActivityGroup.test.tsx`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/MessageActionBar.tsx`
- `desktop/src/components/chat/MessageList.test.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/components/chat/ThinkingBlock.test.tsx`
- `desktop/src/components/chat/ThinkingBlock.tsx`
- `desktop/src/components/chat/ToolCallGroup.test.tsx`
- `desktop/src/components/chat/ToolCallGroup.tsx`
- `desktop/src/components/chat/TurnCompletionStamp.test.tsx`
- `desktop/src/components/chat/TurnCompletionStamp.tsx`
- `desktop/src/components/chat/activityGroupModel.ts`
- `desktop/src/hooks/useCompactMetrics.ts`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `desktop/src/lib/turnCompletion.test.ts`
- `desktop/src/lib/turnCompletion.ts`
- `desktop/src/stores/__fixtures__/chat-store.golden.json`
- `desktop/src/stores/chatStore.test.ts`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/stores/sessionUsageRestore.test.ts`
- `desktop/src/types/chat.ts`
- `desktop/src/types/session.ts`
- `src/server/__tests__/fixtures/translate-cli-message.golden.json`
- `src/server/__tests__/session-messages-http.test.ts`
- `src/server/__tests__/translateCliMessage.agentRunMessage.test.ts`
- `src/server/__tests__/translateCliMessage.golden.test.ts`
- `src/server/__tests__/ws-memory-events.test.ts`
- `src/server/api/sessions.ts`
- `src/server/services/agentRunUsageProjection.test.ts`
- `src/server/services/agentRunUsageProjection.ts`
- `src/server/services/conversationService.ts`
- `src/server/services/sessionService.ts`
- `src/server/services/sessionUsageRollup.test.ts`
- `src/server/services/sessionUsageRollup.ts`
- `src/server/services/subagentRunService.ts`
- `src/server/ws/agentTaskState.test.ts`
- `src/server/ws/agentTaskState.ts`
- `src/server/ws/events.ts`
- `src/server/ws/handler.ts`
- `src/server/ws/streamBlocks.ts`
- `src/services/api/claude.ts`
- `src/services/api/emptyUsage.ts`
- `src/services/tokenEstimation.test.ts`
- `src/services/tokenEstimation.ts`
- `src/tasks/LocalAgentTask/LocalAgentTask.test.ts`
- `src/tasks/LocalAgentTask/LocalAgentTask.tsx`
- `src/tools/AgentTool/AgentTool.tsx`
- `src/tools/AgentTool/agentToolUtils.test.ts`
- `src/tools/AgentTool/agentToolUtils.ts`
- `src/utils/sdkEventQueue.ts`
- `src/utils/task/sdkProgress.ts`
- `src/utils/taskNotificationPolicy.ts`
- `src/utils/tokens.ts`

### 依赖补齐（链内共享文件，取链终态；10）

- `desktop/src/api/h5Access.ts`
- `desktop/src/components/chat/DownloadReferencesCard.tsx`
- `desktop/src/lib/desktopRuntime.ts`
- `desktop/src/lib/downloadFileMeta.ts`
- `desktop/src/lib/fileSizeCache.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/lib/tpsCalibration.ts`
- `desktop/src/lib/tpsMeter.ts`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/settings.ts`

### ⚠️ 上游 main 自基座也改过（21）

- `desktop/src/api/sessions.ts`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/MessageList.test.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/stores/chatStore.test.ts`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/types/chat.ts`
- `src/server/__tests__/session-messages-http.test.ts`
- `src/server/api/sessions.ts`
- `src/server/services/conversationService.ts`
- `src/server/services/sessionService.ts`
- `src/server/ws/events.ts`
- `src/server/ws/handler.ts`
- `src/services/api/claude.ts`
- `src/tools/AgentTool/AgentTool.tsx`
