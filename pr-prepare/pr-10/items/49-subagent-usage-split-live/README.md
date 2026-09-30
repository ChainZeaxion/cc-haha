# 49-subagent-usage-split-live — 还原会话的 think/非think 拆分 + 组栏运行中实时跟进（链位 49，`49-subagent-usage-split-live.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 49，patch `49-subagent-usage-split-live.patch`（本目录）

- 需求背景：用户要求「think 不回传就应显示成 think 用量 + 非think 用量」（而非只有 think 回传时才有的一条总用量），并「对派发子代理总收纳栏的用量和耗时做实时跟进（每 5s 刷新），完成后二次校验修正」。
- 方案：
  - 三段根因：①历史转录本无拆分（`<usage>` 块只在 `reasoningTokens != null` 时写，pilot 58/58 只有旧口径 total）；②数据其实在子代理转录（76 个 general-purpose Σ`output_tokens`=727,879、Σthink=457,285）；③还原路径拿不到 usage（`SessionTaskNotification` 无 `usage` 字段）、组栏读错地方（读「已完成通知」而非「运行中记录」）；
  - 服务端新增 `sessionUsageRollup.ts`：按 `toolUseId` 关联子代理转录，逐轮累加 output、思考取「引擎真值否则估算」，与 `finalizeAgentTool` 同口径，结果作为 `usage` 随 `taskNotifications` 下发；缓存按 `getSessionMessagesSignature` 失效；
  - 客户端：组栏新增 `agentTaskLiveUsage`（`MessageList` 由 `backgroundAgentTasks` 派生、只取 `status==='running'`），「运行中记录优先、否则回落完成通知」；耗时用墙钟跨度（在飞成员以 now 闭合），数字标 ≈；完成通知即二次校正；实时节奏复用思考徽章 `LIVE_ELAPSED_REFRESH_MS`（3s）。
- 验证：数字对账（pilot `f1be2b52`）API 返回 60 条带 usage，Σtotal=727,879、Σthink=457,330 与独立手工核算一致，单次请求 ≈0.18s；`bun run check:server` 493 文件 5947 通过 0 失败，前端全量 6341 通过 0 失败，`tsc -b` 0 错。
