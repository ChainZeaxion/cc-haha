# session — 会话及相关优化（会话基础 + 文件下载 + 大会话加载/传输性能 + 打开提速）

- PR 分支：`session-related-optimizations`｜主题目录：`pr-prepare/session/`
- 上游文档章节：二/三/五/六/八/二十/二十二
- 单一真相源 patch 目录：`modify/patches/session/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；78 文件 +7725−333）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `session-export` | `session-export-patch1.patch` | 3 | +493−38 | 5 |
| `session-refresh` | `session-refresh-patch1.patch` | 6 | +183−7 | 2 |
| `session-file-download` | `session-file-download-patch1.patch` | 8,45,51,53 | +644−44 | 15 |
| `session-disable-updates` | `session-disable-updates-patch1.patch` | 9 | +145−1 | 4 |
| `session-thinking-switch` | `session-thinking-switch-patch1.patch` | 11 | +349−7 | 11 |
| `session-gzip-transport` | `session-gzip-transport-patch1.patch` | 20,25 | +415−1 | 3 |
| `session-history-transport` | `session-history-transport-patch1.patch` | 23,24,26,31 | +363−16 | 9 |
| `session-baseline-typecheck` | `session-baseline-typecheck-patch1.patch` | 27 | +7−4 | 2 |
| `session-open-speed` | `session-open-speed-patch1.patch` | 55,56,57 | +526−22 | 6 |

## 文件清单（组补丁含 78 文件）

### 本主题优化项直接改动（54）

- `desktop/src/api/sessions.test.ts`
- `desktop/src/api/sessions.ts`
- `desktop/src/components/ExportConversationDialog.tsx`
- `desktop/src/components/chat/DownloadReferencesCard.tsx`
- `desktop/src/components/chat/ToolCallGroup.tsx`
- `desktop/src/components/composite/OpenWithMenu.tsx`
- `desktop/src/components/layout/AppShell.tsx`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/components/workbench/WorkspaceFileTreePane.test.tsx`
- `desktop/src/components/workbench/WorkspaceFileTreePane.tsx`
- `desktop/src/components/workspace/WorkspaceFileOpenWith.test.tsx`
- `desktop/src/components/workspace/WorkspaceFileOpenWith.tsx`
- `desktop/src/lib/downloadFileMeta.ts`
- `desktop/src/lib/fileSizeCache.ts`
- `desktop/src/lib/handlePreviewLink.test.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/lib/openWithItems.ts`
- `desktop/src/lib/openWithMenuItems.ts`
- `desktop/src/lib/sessionExport.ts`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/pages/settings/AboutSettings.tsx`
- `desktop/src/pages/settings/GeneralSettings.tsx`
- `desktop/src/stores/updateStore.test.ts`
- `desktop/src/stores/updateStore.ts`
- `desktop/src/types/session.ts`
- `src/server/__tests__/providers.test.ts`
- `src/server/__tests__/session-metadata-projection-durable.test.ts`
- `src/server/__tests__/session-transcript-presence.test.ts`
- `src/server/api/localFile.ts`
- `src/server/api/previewFs.ts`
- `src/server/index.ts`
- `src/server/proxy/handler.ts`
- `src/server/remoteBrowserPolicy.test.ts`
- `src/server/responseCompression.test.ts`
- `src/server/responseCompression.ts`
- `src/server/services/boundedSessionHistory.test.ts`
- `src/server/services/boundedSessionHistory.ts`
- `src/server/services/sessionHistoryContext.test.ts`
- `src/server/services/sessionHistoryContext.ts`
- `src/server/services/sessionService.ts`
- `src/server/services/transcriptMetadataCache.ts`
- `src/services/api/claude.ts`
- `src/services/openaiAuth/fetch.ts`
- `src/tools/ConfigTool/supportedSettings.ts`
- `src/utils/__tests__/thinking.test.ts`
- `src/utils/fileHistory.security.test.ts`
- `src/utils/fileHistory.ts`
- `src/utils/messages.test.ts`
- `src/utils/messages.ts`
- `src/utils/sessionStorage.originalFileBound.test.ts`
- `src/utils/sessionStorage.ts`
- `src/utils/settings/types.ts`
- `src/utils/thinking.ts`
- `src/vendor/computer-use-mcp/toolCalls.test.ts`

### 依赖补齐（链内共享文件，取链终态；24）

- `desktop/src/api/h5Access.ts`
- `desktop/src/api/subagents.ts`
- `desktop/src/components/activity/SessionActivityPanel.tsx`
- `desktop/src/components/activity/sessionActivityModel.ts`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/components/chat/MobileQuickActions.tsx`
- `desktop/src/components/chat/SessionCostBadge.tsx`
- `desktop/src/components/chat/ThinkingBlock.tsx`
- `desktop/src/components/chat/TpsIndicator.tsx`
- `desktop/src/components/chat/activityGroupModel.ts`
- `desktop/src/hooks/useCompactMetrics.ts`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/lib/desktopHost/browserHost.ts`
- `desktop/src/lib/desktopHost/terminalWs.ts`
- `desktop/src/lib/desktopRuntime.ts`
- `desktop/src/lib/sessionUsageMetrics.ts`
- `desktop/src/lib/tpsCalibration.ts`
- `desktop/src/lib/tpsMeter.ts`
- `desktop/src/lib/turnCompletion.ts`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/chat.ts`
- `desktop/src/types/settings.ts`

### ⚠️ 上游 main 自基座也改过（27）

- `desktop/src/api/sessions.test.ts`
- `desktop/src/api/sessions.ts`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/components/layout/AppShell.tsx`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/components/workbench/WorkspaceFileTreePane.test.tsx`
- `desktop/src/components/workbench/WorkspaceFileTreePane.tsx`
- `desktop/src/components/workspace/WorkspaceFileOpenWith.test.tsx`
- `desktop/src/components/workspace/WorkspaceFileOpenWith.tsx`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/lib/handlePreviewLink.test.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/lib/openWithItems.ts`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/types/chat.ts`
- `src/server/__tests__/providers.test.ts`
- `src/server/index.ts`
- `src/server/proxy/handler.ts`
- `src/server/services/sessionHistoryContext.test.ts`
- `src/server/services/sessionHistoryContext.ts`
- `src/server/services/sessionService.ts`
- `src/services/api/claude.ts`
- `src/utils/messages.test.ts`
- `src/utils/messages.ts`
- `src/utils/thinking.ts`
