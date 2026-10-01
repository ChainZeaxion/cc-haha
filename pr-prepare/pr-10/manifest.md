# pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）

- 上游文档章节：二十一/二十六/二十八.2/二十五
- 建议分支：`pr/thinking-subagent`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 21 | `items/21-thinking-tool-timing/21-thinking-tool-timing.patch` | +532/−54 | 20 | 二十一 思考计时与工具计时综合优化（思考 badge+收纳栏总计时+token） |
| 28 | `items/28-thinking-badge-order-and-duration/28-thinking-badge-order-and-duration.patch` | +84/−25 | 6 | 二十一 子优化①：收纳栏「token 在前、耗时在后」+ `+` 间隔收紧 + 零耗时按未测处理 |
| 29 | `items/29-turn-usage/29-turn-usage.patch` | +463/−7 | 12 | 二十一 子优化②：轮次用量（每轮总消耗 token，口径=真实 `output_tokens`，`usageKey` 去重） |
| 39 | `items/39-subagent-background-task-durations/39-subagent-background-task-durations.patch` | +547/−15 | 12 | 二十一 子优化④：**子代理耗时 + 子代理收纳栏总耗时 + 后台任务耗时**（汇总栏取**区间并集跨度**而非求和——子代理是并发派发；`agentRunInterval`/`agentGroupSpanMs` 另立，因全 Agent 组 |
| 41 | `items/41-background-task-duration-restore/41-background-task-duration-restore.patch` | +261/−25 | 6 | 二十一 子优化④ 补记二：后台任务耗时**恢复三层根因**（①`historyComplete=false` 时窗口被整空 → 跨度类重建改用已加载窗口；②通知型任务无起点 → 用其 `toolUseId` 的工具调用时刻回填；③**mer |
| 43 | `items/43-think-token-truth-chain/43-think-token-truth-chain.patch` | +669/−37 | 21 | 二十一 子优化⑤：**思考 token 走引擎真值**——代理透传 `reasoning_tokens` → usage 保活强转 → `ProgressTracker` 逐轮「真值否则估算」→ `AgentTaskNotification |
| 49 | `items/49-subagent-usage-split-live/49-subagent-usage-split-live.patch` | +781/−51 | 13 | 二十一 子优化⑥：**还原会话的 think/非think 拆分 + 组栏运行中实时跟进**——服务端 `sessionUsageRollup` 按 `toolUseId` 从子代理转录推导 usage 随通知下发（完成态权威）；组栏改读* |
| 52 | `items/52-split-no-double-count/52-split-no-double-count.patch` | +166/−14 | 4 | 二十六 补记：**拆分「真实用量 0」**——一轮响应拆成两条记录（思考一条、正文一条，**共享 `message.id`**），只有带 usage 的那条能报 reasoning ⇒ 估算又叠真值（think 15.7k > total  |
| 61 | `items/61-subagent-live-metrics/61-subagent-live-metrics.patch` | +136/−17 | 5 | 二十一 子优化⑤：**子代理运行中用量/耗时真正爬升 + 移动端紧凑 + TPS 汇聚子代理读数修复**——（a）`subagentLiveChars` 累积器 + 3s 节流把在飞子代理的用量写进 `backgroundAgentTask |
| 63 | `items/63-subagent-usage-cross-client/63-subagent-usage-cross-client.patch` | +1067/−39 | 11 | 二十八 28.2：**子代理跨客户端用量一致性**——① **身份对齐**（真根因）：`runAgentId` 与「派发它的 Agent 工具调用 id」被混用（UI 按 `toolUseId` 读、实时写入方却填成 runAgentId） |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「二十一」：自第 1551 行起
- 章节「二十六」：自第 2269 行起
- 章节「二十八」：自第 2435 行起

## 文件清单

- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/sessions.ts` （本组 patch 直接改动）
- `desktop/src/api/subagents.ts` （本组 patch 直接改动）
- `desktop/src/components/activity/SessionActivityPanel.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/activity/SessionActivityPanel.tsx` （本组 patch 直接改动）
- `desktop/src/components/activity/sessionActivityModel.ts` （本组 patch 直接改动）
- `desktop/src/components/chat/ActivityGroup.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/ActivityGroup.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/DownloadReferencesCard.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/MessageActionBar.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/MessageList.test.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/components/chat/MessageList.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/components/chat/ThinkingBlock.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/ThinkingBlock.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/ToolCallGroup.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/ToolCallGroup.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/TurnCompletionStamp.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/TurnCompletionStamp.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/activityGroupModel.ts` （本组 patch 直接改动）
- `desktop/src/hooks/useCompactMetrics.ts` （本组 patch 直接改动）
- `desktop/src/i18n/locales/en.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/jp.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/kr.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh-TW.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/lib/desktopRuntime.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/downloadFileMeta.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/fileSizeCache.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/handlePreviewLink.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/tpsCalibration.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/tpsMeter.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/turnCompletion.test.ts` （本组 patch 直接改动）
- `desktop/src/lib/turnCompletion.ts` （本组 patch 直接改动）
- `desktop/src/stores/__fixtures__/chat-store.golden.json` （本组 patch 直接改动）
- `desktop/src/stores/chatStore.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/stores/chatStore.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/stores/sessionUsageRestore.test.ts` （本组 patch 直接改动）
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/chat.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/types/session.ts` （本组 patch 直接改动）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `src/server/__tests__/fixtures/translate-cli-message.golden.json` （本组 patch 直接改动）
- `src/server/__tests__/session-messages-http.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/__tests__/translateCliMessage.agentRunMessage.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/translateCliMessage.golden.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/ws-memory-events.test.ts` （本组 patch 直接改动）
- `src/server/api/sessions.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/agentRunUsageProjection.test.ts` （本组 patch 直接改动）
- `src/server/services/agentRunUsageProjection.ts` （本组 patch 直接改动）
- `src/server/services/conversationService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/sessionService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/sessionUsageRollup.test.ts` （本组 patch 直接改动）
- `src/server/services/sessionUsageRollup.ts` （本组 patch 直接改动）
- `src/server/services/subagentRunService.ts` （本组 patch 直接改动）
- `src/server/ws/agentTaskState.test.ts` （本组 patch 直接改动）
- `src/server/ws/agentTaskState.ts` （本组 patch 直接改动）
- `src/server/ws/events.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/ws/handler.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/ws/streamBlocks.ts` （本组 patch 直接改动）
- `src/services/api/claude.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/services/api/emptyUsage.ts` （本组 patch 直接改动）
- `src/services/tokenEstimation.test.ts` （本组 patch 直接改动）
- `src/services/tokenEstimation.ts` （本组 patch 直接改动）
- `src/tasks/LocalAgentTask/LocalAgentTask.test.ts` （本组 patch 直接改动）
- `src/tasks/LocalAgentTask/LocalAgentTask.tsx` （本组 patch 直接改动）
- `src/tools/AgentTool/AgentTool.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/tools/AgentTool/agentToolUtils.test.ts` （本组 patch 直接改动）
- `src/tools/AgentTool/agentToolUtils.ts` （本组 patch 直接改动）
- `src/utils/sdkEventQueue.ts` （本组 patch 直接改动）
- `src/utils/task/sdkProgress.ts` （本组 patch 直接改动）
- `src/utils/taskNotificationPolicy.ts` （本组 patch 直接改动）
- `src/utils/tokens.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
