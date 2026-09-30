# pr-1 — H5 远程访问与移动端支持

- 上游文档章节：一/九/十一/十四/十五/十七/二十五/十补记
- 建议分支：`pr/h5-remote-access`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 1 | `items/01-h5-require-token/01-h5-require-token.patch` | +721/−102 | 23 | 一 H5 令牌开关 + 免令牌豁免 |
| 2 | `items/02-h5-auto-mode-optin/02-h5-auto-mode-optin.patch` | +115/−11 | 2 | 一 H5 选「自动模式」400 修复（1.1） |
| 4 | `items/04-h5-settings-parity/04-h5-settings-parity.patch` | +212/−134 | 4 | 九 H5 设置全 tab 对齐 |
| 5 | `items/05-h5-terminal-bridge/05-h5-terminal-bridge.patch` | +1644/−31 | 9 | 一 H5 终端桥接（1.2） |
| 13 | `items/13-h5-mobile-quick-actions/13-h5-mobile-quick-actions.patch` | +251/−0 | 3 | 十一 H5 悬浮快捷入口（任务/终端/文件/审查） |
| 15 | `items/15-h5-mobile-scheduled/15-h5-mobile-scheduled.patch` | +4/−3 | 2 | 十五 H5/移动端支持打开计划任务（定时任务）页 |
| 17 | `items/17-h5-mobile-market-layout/17-h5-mobile-market-layout.patch` | +1/−1 | 1 | 十七 H5/移动端 技能市场页 header 布局适配 |
| 34 | `items/34-h5-mobile-run-records/34-h5-mobile-run-records.patch` | +52/−1 | 2 | 二十五 **H5 打不开子代理运行记录**：移动端 tab 守卫白名单补 `subagent`/`team-member`（+ 2 测试） |
| 46 | `items/46-local-index-extra-project-roots/46-local-index-extra-project-roots.patch` | +222/−98 | 3 | 十 补记：`CC_HAHA_EXTRA_PROJECT_ROOTS` **额外索引根**——dev 实例用自己的 `CLAUDE_CONFIG_DIR` ⇒ 发现根随之变成自己的，真实目录的会话永不出现；该配置可额外索引真实 `projec |
| 48 | `items/48-session-list-multi-root-validation/48-session-list-multi-root-validation.patch` | +70/−23 | 1 | 十 补记二：会话列表**逐行校验改按全部索引根**——只认本配置目录的根时，额外根来的行被判越界并被 `catch` **静默丢弃**（于是 `total` 报得对、行数只剩 2）；平铺 2 → 84、侧边栏分组恢复（1 文件 70 增） |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「一」：自第 152 行起
- 章节「一之1.1」：自第 192 行起
- 章节「一之1.2」：自第 205 行起
- 章节「九」：自第 911 行起
- 章节「九.x」：自第 947 行起
- 章节「十一」：自第 1036 行起
- 章节「十四」：自第 1266 行起
- 章节「十五」：自第 1286 行起
- 章节「十七」：自第 1337 行起
- 章节「二十五」：自第 2230 行起
- 章节「十」：自第 965 行起

## 文件清单

- `desktop/src/__tests__/generalSettings.test.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/api/computerUse.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/h5Access.ts` （本组 patch 直接改动）
- `desktop/src/api/sessions.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/subagents.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/terminal.test.ts` （本组 patch 直接改动）
- `desktop/src/components/ExportConversationDialog.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/activity/SessionActivityPanel.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/activity/sessionActivityModel.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ActivityGroup.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/DownloadReferencesCard.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/MessageList.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/components/chat/MobileQuickActions.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/MobileQuickActions.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/SessionCostBadge.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ThinkingBlock.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ToolCallGroup.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/TpsIndicator.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/activityGroupModel.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/layout/AppShell.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/layout/AppShell.tsx` （本组 patch 直接改动）
- `desktop/src/components/layout/Sidebar.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/layout/Sidebar.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/market/MarketHome.tsx` （本组 patch 直接改动）
- `desktop/src/hooks/useCompactMetrics.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/i18n/locales/en.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/jp.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/kr.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh-TW.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/lib/desktopHost/browserHost.ts` （本组 patch 直接改动）
- `desktop/src/lib/desktopHost/contract.test.ts` （本组 patch 直接改动）
- `desktop/src/lib/desktopHost/terminalWs.ts` （本组 patch 直接改动）
- `desktop/src/lib/desktopRuntime.test.ts` （本组 patch 直接改动）
- `desktop/src/lib/desktopRuntime.ts` （本组 patch 直接改动）
- `desktop/src/lib/downloadFileMeta.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/fileSizeCache.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/handlePreviewLink.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/sessionExport.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/sessionUsageMetrics.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/tpsCalibration.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/tpsMeter.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/turnCompletion.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/ActiveSession.test.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/pages/ActiveSession.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/pages/ComputerUseSettings.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/ScheduledTasks.tsx` （本组 patch 直接改动）
- `desktop/src/pages/Settings.tsx` （本组 patch 直接改动）
- `desktop/src/pages/TerminalSettings.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/settings/AboutSettings.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/settings/GeneralSettings.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/settings/H5AccessSettings.tsx` （本组 patch 直接改动）
- `desktop/src/pages/settings/H5GeneralSettings.tsx` （本组 patch 直接改动）
- `desktop/src/pages/settings/H5Settings.test.tsx` （本组 patch 直接改动）
- `desktop/src/pages/settings/H5Settings.tsx` （本组 patch 直接改动）
- `desktop/src/stores/chatStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/stores/settingsStore.test.ts` （本组 patch 直接改动）
- `desktop/src/stores/settingsStore.ts` （本组 patch 直接改动）
- `desktop/src/stores/updateStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/chat.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/types/session.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （本组 patch 直接改动）
- `package.json` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/__fixtures__/remoteBrowserSettingsSmoke.ts` （本组 patch 直接改动）
- `src/server/__tests__/h5-access-api.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/h5-access-auth.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/__tests__/h5-access-policy.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/h5-access-service.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/terminal-service.test.ts` （本组 patch 直接改动）
- `src/server/api/h5-access.ts` （本组 patch 直接改动）
- `src/server/api/terminal.ts` （本组 patch 直接改动）
- `src/server/h5AccessPolicy.ts` （本组 patch 直接改动）
- `src/server/index.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/remoteBrowserPolicy.ts` （本组 patch 直接改动）
- `src/server/router.remoteBrowser.test.ts` （本组 patch 直接改动）
- `src/server/router.ts` （本组 patch 直接改动）
- `src/server/services/h5AccessService.ts` （本组 patch 直接改动）
- `src/server/services/localIndex/config.ts` （本组 patch 直接改动）
- `src/server/services/localIndex/coordinator.test.ts` （本组 patch 直接改动）
- `src/server/services/localIndex/coordinator.ts` （本组 patch 直接改动）
- `src/server/services/sessionService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/terminalService.ts` （本组 patch 直接改动）
- `src/server/ws/handler.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
