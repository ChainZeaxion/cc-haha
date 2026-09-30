# pr-5 — 上下文缓存计费与用量聚合显示

- 上游文档章节：七/十九/四子优化(速度配对)
- 建议分支：`pr/usage-billing`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 10 | `items/10-cache-billing/10-cache-billing.patch` | +274/−30 | 7 | 七 上下文缓存与计费显示 |
| 19 | `items/19-context-usage-anchor/19-context-usage-anchor.patch` | +74/−12 | 4 | 十九 bc 压缩后 context usage 不收敛（显示总量 usage 锚口径 + projector metadata 上限加固） |
| 37 | `items/37-session-speed-and-usage-pairing/37-session-speed-and-usage-pairing.patch` | +427/−56 | 13 | 四 子优化：**面板「生成速度」分子分母配对**（decode 只除「同批被测到 span 的 token」，非流式回退不再抬高速度）+ **transcript usage 去重改保留末行**（首行 `output_tokens: 0`  |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「七」：自第 810 行起
- 章节「十九」：自第 1463 行起
- 章节「四」：自第 307 行起

## 文件清单

- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/sessions.ts` （本组 patch 直接改动）
- `desktop/src/components/chat/ContextUsageDetails.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/ContextUsageIndicator.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/ContextUsageIndicator.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/LocalSlashCommandPanel.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/SessionCostBadge.tsx` （本组 patch 直接改动）
- `desktop/src/lib/desktopRuntime.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/sessionUsageMetrics.test.ts` （本组 patch 直接改动）
- `desktop/src/lib/sessionUsageMetrics.ts` （本组 patch 直接改动）
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/chat.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/types/session.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `src/QueryEngine.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/bootstrap/state.generationTiming.test.ts` （本组 patch 直接改动）
- `src/bootstrap/state.ts` （本组 patch 直接改动）
- `src/cost-tracker.ts` （本组 patch 直接改动）
- `src/server/__tests__/conversations.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/__tests__/sessions.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/localIndex/sessionProjector.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/localIndex/sessionProjector.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/localIndex/transcriptReducer.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/localIndex/transcriptReducer.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/sessionService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/utils/config.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
