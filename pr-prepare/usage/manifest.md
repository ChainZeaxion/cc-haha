# usage — 上下文缓存计费与用量聚合显示

- PR 分支：`usage-billing`｜主题目录：`pr-prepare/usage/`
- 上游文档章节：七/十九
- 单一真相源 patch 目录：`modify/patches/usage/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；26 文件 +1250−152）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `usage-cache-billing` | `usage-cache-billing-patch1.patch` | 10 | +311−30 | 7 |
| `usage-context-usage-anchor` | `usage-context-usage-anchor-patch1.patch` | 19 | +74−12 | 4 |
| `usage-session-speed-usage-pairing` | `usage-session-speed-usage-pairing-patch1.patch` | 37 | +375−41 | 11 |

## 文件清单（组补丁含 26 文件）

### 本主题优化项直接改动（20）

- `desktop/src/api/sessions.ts`
- `desktop/src/components/chat/ContextUsageDetails.tsx`
- `desktop/src/components/chat/ContextUsageIndicator.test.tsx`
- `desktop/src/components/chat/ContextUsageIndicator.tsx`
- `desktop/src/components/chat/LocalSlashCommandPanel.tsx`
- `desktop/src/components/chat/SessionCostBadge.tsx`
- `desktop/src/lib/sessionUsageMetrics.test.ts`
- `desktop/src/lib/sessionUsageMetrics.ts`
- `src/QueryEngine.ts`
- `src/bootstrap/state.generationTiming.test.ts`
- `src/bootstrap/state.ts`
- `src/cost-tracker.ts`
- `src/server/__tests__/conversations.test.ts`
- `src/server/__tests__/sessions.test.ts`
- `src/server/services/localIndex/sessionProjector.test.ts`
- `src/server/services/localIndex/sessionProjector.ts`
- `src/server/services/localIndex/transcriptReducer.test.ts`
- `src/server/services/localIndex/transcriptReducer.ts`
- `src/server/services/sessionService.ts`
- `src/utils/config.ts`

### 依赖补齐（链内共享文件，取链终态；6）

- `desktop/src/api/h5Access.ts`
- `desktop/src/lib/desktopRuntime.ts`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/chat.ts`
- `desktop/src/types/session.ts`
- `desktop/src/types/settings.ts`

### ⚠️ 上游 main 自基座也改过（10）

- `desktop/src/api/sessions.ts`
- `desktop/src/types/chat.ts`
- `src/QueryEngine.ts`
- `src/server/__tests__/conversations.test.ts`
- `src/server/__tests__/sessions.test.ts`
- `src/server/services/localIndex/sessionProjector.test.ts`
- `src/server/services/localIndex/sessionProjector.ts`
- `src/server/services/localIndex/transcriptReducer.test.ts`
- `src/server/services/localIndex/transcriptReducer.ts`
- `src/server/services/sessionService.ts`
