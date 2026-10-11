# 19-context-usage-anchor — bc 压缩后 context usage 不收敛：显示总量改 usage 锚口径（链位 19，19-context-usage-anchor.patch）

> 功能组：pr-5 — 上下文缓存计费与用量聚合显示（pr-prepare/pr-5/）
> 链位 19，patch `19-context-usage-anchor.patch`（本目录）

- 需求背景：bc/bili 中间件（无状态全量拼历史 + salvage 压缩）夹在 sidecar 与引擎之间，bc 压缩不向 sidecar 发任何 compact_boundary 信号，而显示路径 `buildTranscriptContextEstimate` 用「自 boundary 全量 rough 累加」（实测某会话 ~787K token = 340% 窗口）参与取 max，显示被钉死 100%；而 auto-compact 判断走 `tokenCountWithEstimation`（usage 锚 + 其后 rough 累加，~92K），同一数据两个口径 → 压缩正常但显示不收敛。
- 方案：
  - 核心（治本，方案 A）：`sessionService.ts` `buildTranscriptContextEstimate` 的 `totalTokens` 从 `min(max(contextBudget.usedTokens, providerTokens + estimatedTokensAfterUsage), rawMaxTokens)` 改为 `min(providerTokens + estimatedTokensAfterUsage, rawMaxTokens)`——显示总量走 usage 锚口径，与 auto-compact 同口径；bc 压缩后 usage 回落 → 百分比收敛。显示只读路径，不碰压缩触发。
  - `estimatedTokens` 全量 rough 口径保留供 `calculateContextBudget` 媒体信任启发式；低信任+媒体的可疑 usage 尖峰仍走 `ignoredUsageReason` 分支（行为不变）。
  - 伴随加固 `sessionProjector.ts`：单字符串 metadata 上限 4KB→16KB（`MAX_PROJECTION_METADATA_VALUE_BYTES`，判定从 `value.length` 字符改为 `Buffer.byteLength` 字节）；metadata 总量上限 16MB→32MB。
- 验证：`conversations.test.ts` 新增「全量 rough 累加(150k)≫真实 usage(1200) 时显示锚定 usage」回归用例（600000 字符消息 + usage 1200，断言 totalTokens=1200 / percentage=1）——stash 旧码验证该用例 fail、新码 pass；src/server 相关 4 测试家族 488/488 绿；068b3ebd 基线全链 apply FAIL=0。
