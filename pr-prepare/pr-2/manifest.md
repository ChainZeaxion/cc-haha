# pr-2 — 会话基础功能（导出/刷新/禁更新/思考开关）

- 上游文档章节：二/三/六/八
- 建议分支：`pr/session-core`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 3 | `items/03-session-export/03-session-export.patch` | +493/−38 | 5 | 二 会话导出 |
| 6 | `items/06-session-refresh/06-session-refresh.patch` | +183/−7 | 2 | 三 会话刷新按钮 |
| 9 | `items/09-disable-updates/09-disable-updates.patch` | +145/−1 | 4 | 六 禁止更新开关 |
| 11 | `items/11-thinking-switch/11-thinking-switch.patch` | +354/−8 | 11 | 八 思考模式二级开关 |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「二」：自第 242 行起
- 章节「三」：自第 277 行起
- 章节「六」：自第 777 行起
- 章节「八」：自第 865 行起

## 文件清单

- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/sessions.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/subagents.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/ExportConversationDialog.tsx` （本组 patch 直接改动）
- `desktop/src/components/activity/SessionActivityPanel.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/activity/sessionActivityModel.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ActivityGroup.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/DownloadReferencesCard.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/MessageList.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/components/chat/MobileQuickActions.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/SessionCostBadge.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ThinkingBlock.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ToolCallGroup.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/TpsIndicator.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/activityGroupModel.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/layout/AppShell.tsx` （本组 patch 直接改动）
- `desktop/src/components/layout/Sidebar.tsx` （本组 patch 直接改动）
- `desktop/src/hooks/useCompactMetrics.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/i18n/locales/en.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/lib/desktopHost/browserHost.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/desktopHost/terminalWs.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/desktopRuntime.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/downloadFileMeta.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/fileSizeCache.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/handlePreviewLink.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/sessionExport.ts` （本组 patch 直接改动）
- `desktop/src/lib/sessionUsageMetrics.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/tpsCalibration.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/tpsMeter.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/turnCompletion.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/ActiveSession.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/pages/settings/AboutSettings.tsx` （本组 patch 直接改动）
- `desktop/src/pages/settings/GeneralSettings.tsx` （本组 patch 直接改动）
- `desktop/src/stores/chatStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/stores/updateStore.test.ts` （本组 patch 直接改动）
- `desktop/src/stores/updateStore.ts` （本组 patch 直接改动）
- `desktop/src/types/chat.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/types/session.ts` （本组 patch 直接改动）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `src/server/__tests__/providers.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/proxy/handler.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/remoteBrowserPolicy.test.ts` （本组 patch 直接改动）
- `src/server/services/sessionService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/services/api/claude.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/services/openaiAuth/fetch.ts` （本组 patch 直接改动）
- `src/tools/ConfigTool/supportedSettings.ts` （本组 patch 直接改动）
- `src/utils/__tests__/thinking.test.ts` （本组 patch 直接改动）
- `src/utils/messages.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/utils/messages.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/utils/settings/types.ts` （本组 patch 直接改动）
- `src/utils/thinking.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
