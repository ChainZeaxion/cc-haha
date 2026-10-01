# 61-subagent-live-metrics — 子代理运行中用量/耗时真正爬升 + 移动端紧凑 + TPS 汇聚读数修复（链位 61，`61-subagent-live-metrics.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 61，patch `61-subagent-live-metrics.patch`（本目录）

- 需求背景：用户要求「子代理收纳栏内用量和耗时攀升」「移动端显示更紧凑、字符间距紧凑」「主会话 TPS 汇聚子代理不准确」。（⚠️ 本 patch 有意保留链位 61 独立、未与链位 21 融合——链位 22→60 有 10+ 补丁同改 `ToolCallGroup.tsx`/`MessageList.tsx`/`chatStore.ts`，回折会逐个重放失败。）
- 方案：
  - ⑤-1 TPS 汇聚读数只有真值 1/3：`tpsMeter.sliceRate()` 可行性过滤只按全局间隔，多流交织后相邻样本常来自不同流（帧间隔中位 0.246ms、66.5%<1ms），正常分片被判「批量投递」丢弃约 70-73%；修法是 `Sample` 加 `stream?`、`push(text,{stream})` 记录来源流，可行性判定改用「同一流上一样本」的间隔（首样本回退 `origin` 保守保留），接线 `ingestSubagentTps(...,msg.runAgentId)`；
  - ⑤-2 移动端紧凑：收纳栏汇总行 compact 态 `gap-[2px] text-[11px] tracking-tight` → `gap-px tracking-tighter`；内层 `data-agent-group-usage` 的 `gap-[3px]` 改随 compact 收紧；轮次页脚 `gap-1.5 tracking-tight` → `gap-1 tracking-tighter`；
  - ⑤-3 用量爬升真根因：`task_progress` 只在工具轮次边界发且只计已完成轮次；客户端其实一直持有 `agent_run_event` 实时增量，新增 `ingestSubagentLiveUsage`（挂 `agent_run_event` 分支，按 `runAgentId` 累加、每 3s 写一次），`totalTokens` 必须含思考 `(text+thinking)/4`；耗时爬升：在飞成员不把「启动回执」当结束（`inFlight ? undefined : resultMap.get(...)`）。
- 验证：离线重放取证——现状全局间隔过滤 20s 后均值 74.7，无过滤 252.7，**按流间隔过滤 244.5**（✅）；端到端复修后 UI 与引擎逐秒对齐（63s 346/331、73s 387/387、85s 381/382）；`tpsMeter.test` 29 通过（+2，新用例旧逻辑必红读到 49.3 期望 >120）；`tsc --noEmit` 0 错。
