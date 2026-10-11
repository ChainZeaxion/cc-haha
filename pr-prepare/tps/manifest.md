# tps — TPS 实时解码速度指示器

- PR 分支：`tps-indicator`｜主题目录：`pr-prepare/tps/`
- 上游文档章节：四/二十八
- 单一真相源 patch 目录：`modify/patches/tps/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；74 文件 +9052−212）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `tps-indicator` | `tps-indicator-patch1.patch` | 7,30,35,38,42,44,50,54 | +2743−14 | 25 |
| `tps-engine-rewrite` | `tps-engine-rewrite-patch1.patch` | 62,64,65,67 | +2269−1002 | 25 |
| `tps-density-estimation` | `tps-density-estimation-patch1.patch` | 66 | +728−43 | 10 |
| `tps-session-total` | `tps-session-total-patch1.patch` | 新增 | +118−70 | 5 |

## 文件清单（组补丁含 74 文件）

### 本主题优化项直接改动（48）

- `desktop/src/components/chat/StreamingIndicator.test.tsx`
- `desktop/src/components/chat/StreamingIndicator.tsx`
- `desktop/src/components/chat/TpsIndicator.test.tsx`
- `desktop/src/components/chat/TpsIndicator.tsx`
- `desktop/src/components/chat/TurnCompletionStamp.tsx`
- `desktop/src/components/layout/AppShell.test.tsx`
- `desktop/src/components/layout/AppShell.tsx`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `desktop/src/lib/tpsCalibration.test.ts`
- `desktop/src/lib/tpsCalibration.ts`
- `desktop/src/lib/tpsDensityStore.test.ts`
- `desktop/src/lib/tpsDensityStore.ts`
- `desktop/src/lib/tpsMeter.test.ts`
- `desktop/src/lib/tpsMeter.ts`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/pages/SubagentRunPage.tsx`
- `desktop/src/stores/chatStore.test.ts`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/types/chat.ts`
- `src/server/__tests__/provider-presets.test.ts`
- `src/server/__tests__/proxy-transform.test.ts`
- `src/server/__tests__/session-messages-http.test.ts`
- `src/server/__tests__/websocket-handler.test.ts`
- `src/server/index.ts`
- `src/server/proxy/handler.ts`
- `src/server/proxy/streaming/anthropicTokenTap.test.ts`
- `src/server/proxy/streaming/anthropicTokenTap.ts`
- `src/server/proxy/streaming/openaiChatStreamToAnthropic.test.ts`
- `src/server/proxy/streaming/openaiChatStreamToAnthropic.ts`
- `src/server/proxy/tpsTokenSink.ts`
- `src/server/proxy/transform/anthropicToOpenaiChat.ts`
- `src/server/proxy/transform/requestCompatibility.test.ts`
- `src/server/proxy/transform/requestCompatibility.ts`
- `src/server/proxy/transform/types.ts`
- `src/server/proxy/transform/usage.ts`
- `src/server/services/agentRunUsageProjection.test.ts`
- `src/server/services/agentRunUsageProjection.ts`
- `src/server/services/api/localEngineHost.ts`
- `src/server/services/providerRuntimeEnv.ts`
- `src/server/types/provider.ts`
- `src/server/ws/events.ts`
- `src/server/ws/handler.ts`
- `src/shared/tokenDensity.test.ts`
- `src/shared/tokenDensity.ts`

### 依赖补齐（链内共享文件，取链终态；26）

- `desktop/src/api/h5Access.ts`
- `desktop/src/api/sessions.ts`
- `desktop/src/api/subagents.ts`
- `desktop/src/components/ExportConversationDialog.tsx`
- `desktop/src/components/activity/SessionActivityPanel.tsx`
- `desktop/src/components/activity/sessionActivityModel.ts`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/DownloadReferencesCard.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/components/chat/MobileQuickActions.tsx`
- `desktop/src/components/chat/SessionCostBadge.tsx`
- `desktop/src/components/chat/ThinkingBlock.tsx`
- `desktop/src/components/chat/ToolCallGroup.tsx`
- `desktop/src/components/chat/activityGroupModel.ts`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/hooks/useCompactMetrics.ts`
- `desktop/src/lib/desktopRuntime.ts`
- `desktop/src/lib/downloadFileMeta.ts`
- `desktop/src/lib/fileSizeCache.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/lib/sessionExport.ts`
- `desktop/src/lib/sessionUsageMetrics.ts`
- `desktop/src/lib/turnCompletion.ts`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/session.ts`
- `desktop/src/types/settings.ts`

### ⚠️ 上游 main 自基座也改过（26）

- `desktop/src/api/sessions.ts`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/components/layout/AppShell.test.tsx`
- `desktop/src/components/layout/AppShell.tsx`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/stores/chatStore.test.ts`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/types/chat.ts`
- `src/server/__tests__/session-messages-http.test.ts`
- `src/server/__tests__/websocket-handler.test.ts`
- `src/server/index.ts`
- `src/server/proxy/handler.ts`
- `src/server/proxy/streaming/openaiChatStreamToAnthropic.test.ts`
- `src/server/proxy/streaming/openaiChatStreamToAnthropic.ts`
- `src/server/services/providerRuntimeEnv.ts`
- `src/server/types/provider.ts`
- `src/server/ws/events.ts`
- `src/server/ws/handler.ts`
