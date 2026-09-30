# pr-2 — 会话及相关优化（合并组）manifest

> 合并自原 pr-2（会话基础）/ pr-4（文件下载）/ pr-9（大会话性能）/ pr-11（打开提速）。
> 基座 068b3ebd → 本组终态：78 文件。`00-group.patch` 已验证 apply 干净、树逐字节一致。

## patch 清单（18 项，按链位排序）

| 链位 | 模块 | patch | 行数 | 文件数 | 文档章节 |
|------|------|-------|------|--------|----------|
| 03 | 会话基础 | `03-session-export.patch` | 629 | 5 | L0 |
| 06 | 会话基础 | `06-session-refresh.patch` | 270 | 2 | L0 |
| 08 | 文件下载 | `08-file-download.patch` | 830 | 14 | L0 |
| 09 | 会话基础 | `09-disable-updates.patch` | 223 | 4 | L0 |
| 11 | 会话基础 | `11-thinking-switch.patch` | 585 | 11 | L0 |
| 20 | 大会话性能 | `20-h5-gzip-transport.patch` | 277 | 3 | L0 |
| 23 | 大会话性能 | `23-history-transport-bounds.patch` | 166 | 3 | L0 |
| 24 | 大会话性能 | `24-file-history-dedup.patch` | 121 | 2 | L0 |
| 25 | 大会话性能 | `25-gzip-transport.patch` | 254 | 3 | L0 |
| 26 | 大会话性能 | `26-history-first-paint-bound.patch` | 114 | 2 | L0 |
| 27 | 大会话性能 | `27-baseline-typecheck-fixes.patch` | 41 | 2 | L0 |
| 31 | 大会话性能 | `31-storage-original-file-bound.patch` | 140 | 2 | L0 |
| 45 | 文件下载 | `45-file-download-attr.patch` | 111 | 2 | L0 |
| 51 | 文件下载 | `51-file-download-blob.patch` | 260 | 4 | L0 |
| 53 | 文件下载 | `53-file-download-anchor.patch` | 224 | 2 | L646 |
| 55 | 打开提速 | `55-session-history-context-durable.patch` | 265 | 2 | L671 |
| 56 | 打开提速 | `56-session-find-bounded-read.patch` | 175 | 2 | L579 |
| 57 | 打开提速 | `57-transcript-metadata-durable.patch` | 252 | 3 | L697 |

## 文件清单（78，本组直接改动 vs 依赖补齐）

- `desktop/src/api/h5Access.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/api/sessions.test.ts` — 本组直接改动
- `desktop/src/api/sessions.ts` — 本组直接改动
- `desktop/src/api/subagents.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/ExportConversationDialog.tsx` — 本组直接改动
- `desktop/src/components/activity/SessionActivityPanel.tsx` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/activity/sessionActivityModel.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/chat/ActivityGroup.tsx` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/chat/DownloadReferencesCard.tsx` — 本组直接改动
- `desktop/src/components/chat/MessageList.tsx` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/chat/MobileQuickActions.tsx` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/chat/SessionCostBadge.tsx` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/chat/ThinkingBlock.tsx` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/chat/ToolCallGroup.tsx` — 本组直接改动
- `desktop/src/components/chat/TpsIndicator.tsx` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/chat/activityGroupModel.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/components/composite/OpenWithMenu.tsx` — 本组直接改动
- `desktop/src/components/layout/AppShell.tsx` — 本组直接改动
- `desktop/src/components/layout/Sidebar.tsx` — 本组直接改动
- `desktop/src/components/workbench/WorkspaceFileTreePane.test.tsx` — 本组直接改动
- `desktop/src/components/workbench/WorkspaceFileTreePane.tsx` — 本组直接改动
- `desktop/src/components/workspace/WorkspaceFileOpenWith.test.tsx` — 本组直接改动
- `desktop/src/components/workspace/WorkspaceFileOpenWith.tsx` — 本组直接改动
- `desktop/src/hooks/useCompactMetrics.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/i18n/locales/en.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/lib/desktopHost/browserHost.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/lib/desktopHost/terminalWs.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/lib/desktopRuntime.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/lib/downloadFileMeta.ts` — 本组直接改动
- `desktop/src/lib/fileSizeCache.ts` — 本组直接改动
- `desktop/src/lib/handlePreviewLink.test.ts` — 本组直接改动
- `desktop/src/lib/handlePreviewLink.ts` — 本组直接改动
- `desktop/src/lib/openWithItems.ts` — 本组直接改动
- `desktop/src/lib/openWithMenuItems.ts` — 本组直接改动
- `desktop/src/lib/sessionExport.ts` — 本组直接改动
- `desktop/src/lib/sessionUsageMetrics.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/lib/tpsCalibration.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/lib/tpsMeter.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/lib/turnCompletion.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/pages/ActiveSession.tsx` — 本组直接改动
- `desktop/src/pages/settings/AboutSettings.tsx` — 本组直接改动
- `desktop/src/pages/settings/GeneralSettings.tsx` — 本组直接改动
- `desktop/src/stores/chatStore.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/stores/settingsStore.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/stores/updateStore.test.ts` — 本组直接改动
- `desktop/src/stores/updateStore.ts` — 本组直接改动
- `desktop/src/types/chat.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `desktop/src/types/session.ts` — 本组直接改动
- `desktop/src/types/settings.ts` — 依赖补齐（他组改动的共享文件，取链内终态）
- `src/server/__tests__/providers.test.ts` — 本组直接改动
- `src/server/__tests__/session-metadata-projection-durable.test.ts` — 本组直接改动
- `src/server/__tests__/session-transcript-presence.test.ts` — 本组直接改动
- `src/server/api/localFile.ts` — 本组直接改动
- `src/server/api/previewFs.ts` — 本组直接改动
- `src/server/index.ts` — 本组直接改动
- `src/server/proxy/handler.ts` — 本组直接改动
- `src/server/remoteBrowserPolicy.test.ts` — 本组直接改动
- `src/server/responseCompression.test.ts` — 本组直接改动
- `src/server/responseCompression.ts` — 本组直接改动
- `src/server/services/boundedSessionHistory.test.ts` — 本组直接改动
- `src/server/services/boundedSessionHistory.ts` — 本组直接改动
- `src/server/services/sessionHistoryContext.test.ts` — 本组直接改动
- `src/server/services/sessionHistoryContext.ts` — 本组直接改动
- `src/server/services/sessionService.ts` — 本组直接改动
- `src/server/services/transcriptMetadataCache.ts` — 本组直接改动
- `src/services/api/claude.ts` — 本组直接改动
- `src/services/openaiAuth/fetch.ts` — 本组直接改动
- `src/tools/ConfigTool/supportedSettings.ts` — 本组直接改动
- `src/utils/__tests__/thinking.test.ts` — 本组直接改动
- `src/utils/fileHistory.security.test.ts` — 本组直接改动
- `src/utils/fileHistory.ts` — 本组直接改动
- `src/utils/messages.test.ts` — 本组直接改动
- `src/utils/messages.ts` — 本组直接改动
- `src/utils/sessionStorage.originalFileBound.test.ts` — 本组直接改动
- `src/utils/sessionStorage.ts` — 本组直接改动
- `src/utils/settings/types.ts` — 本组直接改动
- `src/utils/thinking.ts` — 本组直接改动
- `src/vendor/computer-use-mcp/toolCalls.test.ts` — 本组直接改动
