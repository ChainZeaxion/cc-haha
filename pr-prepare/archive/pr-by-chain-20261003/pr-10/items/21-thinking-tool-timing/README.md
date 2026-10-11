# 21-thinking-tool-timing — 思考计时与工具计时综合优化（链位 21，`21-thinking-tool-timing.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 21，patch `21-thinking-tool-timing.patch`（本目录）

- 需求背景：用户要求「记录每次思考耗时并在对话记录里体现」，并递进为「think 横条右侧显示 token 用量（xx.xk）+ 耗时（三档阶梯）」；think 与工具不同，须从一开始持续计时，每 3 秒刷新一次，结束后固定。同时要求把「思考+工具收纳栏」的计时改为总计时、收纳栏 token 统计里「工具」部分按结果内容估算。
- 方案：
  - SDK 侧 `claude.ts` 在 `content_block_start(thinking)` 按 block index 记 `thinkingStartedAtByIndex`，块落 transcript 时算 `thinkingDurationMs` 写入 assistant meta（持久化，重开可回显）；
  - WS 侧 `streamBlocks.ts`/`handler.ts` 记 `thinkingBlockStarts`，`thinking_delta` 携带 `serverStart`（每 delta 幂等）；`events.ts`/`types/chat.ts` 加 `serverStart?`；
  - 客户端 `chatStore.settleThinkingDurations()` 在 `activeThinkingId` 清空点（text/tool_use block_start、message_complete、api_retry）把 `now - timestamp` 盖到 `thinkingDurationMs`；历史映射从 transcript 取值；
  - `ThinkingBlock.tsx` 纯函数 `thinkingBadgeLabel`/`formatThinkingTokens`/`formatThinkingDuration` + 3s `setInterval`（锚定 `serverStart`）；无耗时记录的旧会话单显 token；
  - `ActivityGroup.tsx`+`activityGroupModel.ts`：`activityDurationMs` 改分段求和，新增 `activityTokenUsage()`/`activityTokenLabel()`。
- 验证：tsc 0 错；前端相关家族 444/444 绿（ThinkingBlock 22 + ActivityGroup 16 + chatBlocks 44 + chatStore 354 + tpsMeter 8），server 3 测试家族 65/65。
