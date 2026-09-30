# 37-session-speed-and-usage-pairing — 面板「生成速度」分子分母配对 + transcript usage 去重保留末行（链位 37，37-session-speed-and-usage-pairing.patch）

> 功能组：pr-5 — 上下文缓存计费与用量聚合显示（pr-prepare/pr-5/）
> 链位 37，patch `37-session-speed-and-usage-pairing.patch`（本目录）

- 需求背景：上下文浮动卡片会话累计速度显示 6044tok/s 明显不合理。定位两缺陷：①分母 `decodeMs` 只由流式路径的 `message_stop` 喂，而非流式回退（`fallbackMessage`，本地引擎经 responses 端点 400/404 大量触发）token 记全、时间记 0 → 分子累积分母不涨；②transcript 里一次调用写两行 usage（首行 message_start 时写、output 恒 0，末行才是最终真值），`claimUsageRecord` 与 `transcriptReducer` 均按 key 首次为准 → output 与 cache_read 全丢（实测某会话接口返回 totalOutputTokens=0，真实 24,356），本地索引 `activity_daily_models` 每行 output/cache_read 也恒 0。
- 方案：
  - 配对计数 `totalTimedOutputTokens`：只累加「确实量到 decode span 的那次调用」的 output token。`state.ts` `addToTotalGenerationDuration(decode, ttft, outputTokens)` + `getTotalTimedOutputTokens()`，随 resume 快照往返（`lastTimedOutputTokens`）；`QueryEngine` 传入 `currentMessageUsage.output_tokens`。
  - 面板 `deriveSessionUsageMetrics` 改为配对分子 ÷ decode 时长；旧快照缺字段或全会话无 span 时回退 `totalOutput / totalAPIDuration`（`totalAPIDuration` 每次调用都记、回退也涵盖，是唯一与全量 token 匹配的分母）。
  - 两处去重都改为保留每个 key 的**末行**：`sessionService` `claimUsageRecord` 返回 `{key, previous}`，末行先回退上一版贡献再加新值，`countedUsage` 由 Set 改 Map；`transcriptReducer` 同法（`Map<string, CountedUsage>` 随投影克隆，`releaseCountedUsage` 回退，含 advisor 子键）。
  - 诚实边界：大量非流式回退的会话会显示较小但真实的速度（只覆盖被测到 span 的调用），而非假的高数字。
- 验证：`sessionUsageMetrics.test` 24（新增「只除同批 token」「无配对 token 退回 API 口径」）、`state.generationTiming.test` 3、`sessions.test` 316、`transcriptReducer.test` 31（各含末行/配对新增用例）、`ContextUsageIndicator.test` 27；服务端 `bun test src/server` 3460 pass / 0 fail；桌面 + 根 tsc 0 错，vitest 6290+ 全绿。
