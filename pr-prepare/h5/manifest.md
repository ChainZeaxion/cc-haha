# h5 — H5 远程访问与移动端支持

- PR 分支：`h5-remote-access`｜主题目录：`pr-prepare/h5/`
- 上游文档章节：一/九/十一/十四/十五/十七/二十五/十补记
- 单一真相源 patch 目录：`modify/patches/h5/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；83 文件 +8401−639）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `h5-access-token` | `h5-access-token-patch1.patch` | 1,2,5 | +2480−144 | 34 |
| `h5-settings-parity` | `h5-settings-parity-patch1.patch` | 4 | +212−134 | 4 |
| `h5-mobile-quick-actions` | `h5-mobile-quick-actions-patch1.patch` | 13 | +251−0 | 3 |
| `h5-mobile-scheduled` | `h5-mobile-scheduled-patch1.patch` | 15 | +4−3 | 2 |
| `h5-mobile-market-layout` | `h5-mobile-market-layout-patch1.patch` | 17 | +1−1 | 1 |
| `h5-mobile-run-records` | `h5-mobile-run-records-patch1.patch` | 34 | +52−1 | 2 |
| `h5-local-index-multi-root` | `h5-local-index-multi-root-patch1.patch` | 46,48 | +292−121 | 4 |

## 文件清单（组补丁含 83 文件）

### 本主题优化项直接改动（50）

- `desktop/src/__tests__/generalSettings.test.tsx`
- `desktop/src/api/h5Access.ts`
- `desktop/src/api/terminal.test.ts`
- `desktop/src/components/chat/MobileQuickActions.test.tsx`
- `desktop/src/components/chat/MobileQuickActions.tsx`
- `desktop/src/components/layout/AppShell.test.tsx`
- `desktop/src/components/layout/AppShell.tsx`
- `desktop/src/components/layout/Sidebar.test.tsx`
- `desktop/src/components/market/MarketHome.tsx`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `desktop/src/lib/desktopHost/browserHost.ts`
- `desktop/src/lib/desktopHost/contract.test.ts`
- `desktop/src/lib/desktopHost/terminalWs.ts`
- `desktop/src/lib/desktopRuntime.test.ts`
- `desktop/src/lib/desktopRuntime.ts`
- `desktop/src/pages/ActiveSession.test.tsx`
- `desktop/src/pages/ScheduledTasks.tsx`
- `desktop/src/pages/Settings.tsx`
- `desktop/src/pages/settings/H5AccessSettings.tsx`
- `desktop/src/pages/settings/H5GeneralSettings.tsx`
- `desktop/src/pages/settings/H5Settings.test.tsx`
- `desktop/src/pages/settings/H5Settings.tsx`
- `desktop/src/stores/settingsStore.test.ts`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/settings.ts`
- `package.json`
- `src/server/__fixtures__/remoteBrowserSettingsSmoke.ts`
- `src/server/__tests__/h5-access-api.test.ts`
- `src/server/__tests__/h5-access-auth.test.ts`
- `src/server/__tests__/h5-access-policy.test.ts`
- `src/server/__tests__/h5-access-service.test.ts`
- `src/server/__tests__/terminal-service.test.ts`
- `src/server/api/h5-access.ts`
- `src/server/api/terminal.ts`
- `src/server/h5AccessPolicy.ts`
- `src/server/index.ts`
- `src/server/remoteBrowserPolicy.ts`
- `src/server/router.remoteBrowser.test.ts`
- `src/server/router.ts`
- `src/server/services/h5AccessService.ts`
- `src/server/services/localIndex/config.ts`
- `src/server/services/localIndex/coordinator.test.ts`
- `src/server/services/localIndex/coordinator.ts`
- `src/server/services/sessionService.ts`
- `src/server/services/terminalService.ts`
- `src/server/ws/handler.ts`

### 依赖补齐（链内共享文件，取链终态；33）

- `desktop/src/api/computerUse.ts`
- `desktop/src/api/sessions.ts`
- `desktop/src/api/subagents.ts`
- `desktop/src/components/ExportConversationDialog.tsx`
- `desktop/src/components/activity/SessionActivityPanel.tsx`
- `desktop/src/components/activity/sessionActivityModel.ts`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/DownloadReferencesCard.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/components/chat/SessionCostBadge.tsx`
- `desktop/src/components/chat/ThinkingBlock.tsx`
- `desktop/src/components/chat/ToolCallGroup.tsx`
- `desktop/src/components/chat/TpsIndicator.tsx`
- `desktop/src/components/chat/activityGroupModel.ts`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/hooks/useCompactMetrics.ts`
- `desktop/src/lib/downloadFileMeta.ts`
- `desktop/src/lib/fileSizeCache.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/lib/sessionExport.ts`
- `desktop/src/lib/sessionUsageMetrics.ts`
- `desktop/src/lib/tpsCalibration.ts`
- `desktop/src/lib/tpsMeter.ts`
- `desktop/src/lib/turnCompletion.ts`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/pages/ComputerUseSettings.tsx`
- `desktop/src/pages/TerminalSettings.tsx`
- `desktop/src/pages/settings/AboutSettings.tsx`
- `desktop/src/pages/settings/GeneralSettings.tsx`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/stores/updateStore.ts`
- `desktop/src/types/chat.ts`
- `desktop/src/types/session.ts`

### ⚠️ 上游 main 自基座也改过（27）

- `desktop/src/__tests__/generalSettings.test.tsx`
- `desktop/src/api/sessions.ts`
- `desktop/src/components/chat/ActivityGroup.tsx`
- `desktop/src/components/chat/MessageList.tsx`
- `desktop/src/components/layout/AppShell.test.tsx`
- `desktop/src/components/layout/AppShell.tsx`
- `desktop/src/components/layout/Sidebar.test.tsx`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `desktop/src/lib/handlePreviewLink.ts`
- `desktop/src/pages/ActiveSession.test.tsx`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/pages/Settings.tsx`
- `desktop/src/stores/chatStore.ts`
- `desktop/src/types/chat.ts`
- `package.json`
- `src/server/__tests__/h5-access-auth.test.ts`
- `src/server/index.ts`
- `src/server/router.ts`
- `src/server/services/localIndex/coordinator.test.ts`
- `src/server/services/localIndex/coordinator.ts`
- `src/server/services/sessionService.ts`
- `src/server/ws/handler.ts`
