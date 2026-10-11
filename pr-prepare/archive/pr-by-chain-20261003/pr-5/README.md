# pr-5 — 上下文缓存计费与用量聚合显示

## 功能域概述

本组统一修正 cc-haha 中「上下文用量 / 缓存命中 / 会话费用 / 生成速度」类读数的口径问题：把缓存命中率从被历史轮稀释的会话累计口径改为请求级最新轮口径并新增会话费用双币显示；把 context usage 显示总量从「自 compact_boundary 全量 rough 累加」改为与 auto-compact 同口径的 usage 锚（治 bc 中间件压缩后百分比不收敛）；把面板「生成速度」的分子分母改为配对口径并修复 transcript usage 去重丢 output。三项均围绕「显示的数字要等于真实测量」，不触碰压缩触发等逻辑路径。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. 上下文缓存命中率口径修正 + 会话总费用显示（链位 10，10-cache-billing.patch）

- 需求背景：旧 fork 的「缓存命中率」用全会话累计口径（`cacheRead / 全会话 prompt`），长 agent 会话每轮重放前文 prompt，累计比值被历史轮稀释到 ~0.5%，与当前缓存实际表现严重不符。用户拍板要求三处全做（header 费用徽标 + 上下文指示器缓存尾巴 + 上下文面板详情行），并按新源码重新设计融合效果；货币 USD/CNY 双显示（CNY = USD × 7.2 固定汇率，仅展示非计费换算）。
- 方案：
  - `sessionUsageMetrics.ts` 新增 `latestTurnCacheHitRate`——请求级口径 `cacheRead / (input + cacheRead + cacheWrite)`，promptTokens=0 返回 null；新增 `CNY_PER_USD = 7.2`、`formatCnyCost`（>0.5 两位小数否则四位，与 USD 同精度）、`formatCompactTokens`。
  - `ContextUsageIndicator.tsx` 从 `displayContext?.apiUsage` 派生最新轮命中率，环形按钮旁增缓存命中尾巴（橙色 #ea580c，无数据不显示）；详情面板 `sessionStats` 以最新轮命中率为首、回退会话累计。
  - `ContextUsageDetails.tsx` 统计行增 cacheReadTokens + totalCostUSD，费用行旁加 CNY。
  - `LocalSlashCommandPanel.tsx` `ContextOverview` 头部增 `98% cached`，第 4 个 pill 在有 cache 时换为命中行。
  - 新增 `SessionCostBadge.tsx`：会话 header 费用徽标，挂载读一次 `getSessionUsage`（`usageOnly` 廉价轮询路径），`produced=0` 不显示，active 时 10s 轮询 + inFlight 防堆叠，双币（移动端 compact 仅 USD）。挂载于桌面 `ActiveSession.tsx` 与移动 `AppShell.tsx`。
  - i18n 5 语言共 4 个新 key（`slash.inspector.context.cache/.cached`、`contextIndicator.cacheHint`、`session.totalCost`）。
  - 子优化（decode-only 速度口径）：分母原用 `totalAPIDuration`（含 TTFT 首 token 等待）致面板速度偏低 ~24%，改为 `decodeMs > 0 ? decodeMs : apiMs`。
- 验证：桌面 tsc -b 0；受影响 4 测试文件 84/84，全量前端 vitest 6143 pass / 2 fail（2 条基线既有，零回归）；dev 7788 live 双端验证费用徽标 `$0.87 · ¥6.27`、缓存尾巴 96.7%、速度 61tok/s（改前 46.2）；含布局微调（尾巴相对按钮定位、popover 384px + flex justify-evenly 等距）逐项 live 像素级确认。

### 2. bc 压缩后 context usage 不收敛：显示总量改 usage 锚口径（链位 19，19-context-usage-anchor.patch）

- 需求背景：bc/bili 中间件（无状态全量拼历史 + salvage 压缩）夹在 sidecar 与引擎之间，bc 压缩不向 sidecar 发任何 compact_boundary 信号，而显示路径 `buildTranscriptContextEstimate` 用「自 boundary 全量 rough 累加」（实测某会话 ~787K token = 340% 窗口）参与取 max，显示被钉死 100%；而 auto-compact 判断走 `tokenCountWithEstimation`（usage 锚 + 其后 rough 累加，~92K），同一数据两个口径 → 压缩正常但显示不收敛。
- 方案：
  - 核心（治本，方案 A）：`sessionService.ts` `buildTranscriptContextEstimate` 的 `totalTokens` 从 `min(max(contextBudget.usedTokens, providerTokens + estimatedTokensAfterUsage), rawMaxTokens)` 改为 `min(providerTokens + estimatedTokensAfterUsage, rawMaxTokens)`——显示总量走 usage 锚口径，与 auto-compact 同口径；bc 压缩后 usage 回落 → 百分比收敛。显示只读路径，不碰压缩触发。
  - `estimatedTokens` 全量 rough 口径保留供 `calculateContextBudget` 媒体信任启发式；低信任+媒体的可疑 usage 尖峰仍走 `ignoredUsageReason` 分支（行为不变）。
  - 伴随加固 `sessionProjector.ts`：单字符串 metadata 上限 4KB→16KB（`MAX_PROJECTION_METADATA_VALUE_BYTES`，判定从 `value.length` 字符改为 `Buffer.byteLength` 字节）；metadata 总量上限 16MB→32MB。
- 验证：`conversations.test.ts` 新增「全量 rough 累加(150k)≫真实 usage(1200) 时显示锚定 usage」回归用例（600000 字符消息 + usage 1200，断言 totalTokens=1200 / percentage=1）——stash 旧码验证该用例 fail、新码 pass；src/server 相关 4 测试家族 488/488 绿；068b3ebd 基线全链 apply FAIL=0。

### 3. 面板「生成速度」分子分母配对 + transcript usage 去重保留末行（链位 37，37-session-speed-and-usage-pairing.patch）

- 需求背景：上下文浮动卡片会话累计速度显示 6044tok/s 明显不合理。定位两缺陷：①分母 `decodeMs` 只由流式路径的 `message_stop` 喂，而非流式回退（`fallbackMessage`，本地引擎经 responses 端点 400/404 大量触发）token 记全、时间记 0 → 分子累积分母不涨；②transcript 里一次调用写两行 usage（首行 message_start 时写、output 恒 0，末行才是最终真值），`claimUsageRecord` 与 `transcriptReducer` 均按 key 首次为准 → output 与 cache_read 全丢（实测某会话接口返回 totalOutputTokens=0，真实 24,356），本地索引 `activity_daily_models` 每行 output/cache_read 也恒 0。
- 方案：
  - 配对计数 `totalTimedOutputTokens`：只累加「确实量到 decode span 的那次调用」的 output token。`state.ts` `addToTotalGenerationDuration(decode, ttft, outputTokens)` + `getTotalTimedOutputTokens()`，随 resume 快照往返（`lastTimedOutputTokens`）；`QueryEngine` 传入 `currentMessageUsage.output_tokens`。
  - 面板 `deriveSessionUsageMetrics` 改为配对分子 ÷ decode 时长；旧快照缺字段或全会话无 span 时回退 `totalOutput / totalAPIDuration`（`totalAPIDuration` 每次调用都记、回退也涵盖，是唯一与全量 token 匹配的分母）。
  - 两处去重都改为保留每个 key 的**末行**：`sessionService` `claimUsageRecord` 返回 `{key, previous}`，末行先回退上一版贡献再加新值，`countedUsage` 由 Set 改 Map；`transcriptReducer` 同法（`Map<string, CountedUsage>` 随投影克隆，`releaseCountedUsage` 回退，含 advisor 子键）。
  - 诚实边界：大量非流式回退的会话会显示较小但真实的速度（只覆盖被测到 span 的调用），而非假的高数字。
- 验证：`sessionUsageMetrics.test` 24（新增「只除同批 token」「无配对 token 退回 API 口径」）、`state.generationTiming.test` 3、`sessions.test` 316、`transcriptReducer.test` 31（各含末行/配对新增用例）、`ContextUsageIndicator.test` 27；服务端 `bun test src/server` 3460 pass / 0 fail；桌面 + 根 tsc 0 错，vitest 6290+ 全绿。

## 验证口径（组级）

- 服务端回归一律以 `bun test src/server` 为既定基线（整树 `bun test src` 合跑有已知假红，不作信号）；本组关键锚点：`conversations.test.ts` 的 usage 锚回归用例（stash 旧码 fail / 新码 pass 钉住改动）、`sessions.test.ts` 与 `transcriptReducer.test.ts` 的末行计价用例、`state.generationTiming.test.ts` 的「span 缺失不计时间也不计 token」。
- 前端基线：全量 vitest 2 条既有失败（providerModels、MessagePayloadRetention）为零回归口径；`ContextUsageIndicator.test.tsx` 是配对契约的守门测试——契约一变（退回 API 口径）它立刻变红，改契约必须显式改测试。
- 全链验证：068b3ebd 基座顺序 apply 本组 patch FAIL=0，涉及文件逐字节等于工作树。

## 与其他组的关系

- pr-3（速度配对相关改动）与本组同改 `sessionUsageMetrics.ts` / `QueryEngine.ts` / `state.ts` 等文件：链位 10 的 decode-only 口径修正是本组的前置，链位 37 的配对口径在其上进一步收紧分子，两者按链序先后 apply 无冲突；提 PR 时注意两组 patch 对这些文件均取「链终态→工作树」差分，单独 apply 时需按链位顺序。
- pr-10 依赖本组确立的 usage 口径：transcript 末行保留修复后，本地索引 `activity_daily_models` 的 output/cache_read 才真实，pr-10 的用量聚合统计建立在这一正确数据源之上。
- 依赖补齐文件（`h5Access.ts`、`desktopRuntime.ts`、`settingsStore.ts`、`types/*.ts`）是链内被其他组改动/新增的传递依赖，本组 patch 上下文引用到，单独 cherry-pick 时需一并带入或先 apply 对应组。

## 风险与备注

- ⚠️ 上游 main 也改过的文件（冲突风险）：`desktop/src/types/chat.ts`、`src/QueryEngine.ts`、`src/server/__tests__/conversations.test.ts`、`src/server/__tests__/sessions.test.ts`、`src/server/services/localIndex/sessionProjector.ts`、`src/server/services/localIndex/sessionProjector.test.ts`、`src/server/services/localIndex/transcriptReducer.ts`、`src/server/services/localIndex/transcriptReducer.test.ts`、`src/server/services/sessionService.ts`。上游若动过 `claimUsageRecord` / `buildTranscriptContextEstimate` / `addToTotalGenerationDuration` 附近代码，三方合并时需逐 hunk 核对。
- CNY 汇率 7.2 为固定展示口径，非计费换算，README/PR 描述中需说明以免上游质疑。
- `SessionCostBadge` 的 10s 轮询只在会话 active 时开启且有 inFlight 防堆叠，但仍建议 PR 描述注明轮询端点为廉价 `usageOnly` 路径。
- 链位 37 的诚实边界（回退多、子代理占比高的会话速度显示偏小）是对用户可见行为的变化，PR 中需主动说明，避免被当成回归。
- 补丁为「链终态（改前）→ 工作树（改后）」差分，`#1..#N` 前置链位不动、无级联，重放时须保证前序链位已 apply。

