# 07-tps-indicator — TPS 指示器基础 + 子代理汇聚 + 展示格式（链位 7，`07-tps-indicator.patch`，8 文件 +776/−7）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 7，patch `07-tps-indicator.patch`（本目录）

- **问题/需求**：流式输出时显示实时解码速度；移动端顶栏空间有限需两行竖排。0.6.6 无任何 TPS 代码。后续多轮子优化（起步速度修正 `BURST_FLOOR_MS=400` 防突发虚高 2000→~75、thinking 计入 TPS、保持值口径改为正文结束前 0.5s 平均、子代理汇聚到主会话并标 `Σn` 徽章、`TPS XXt/s` 格式 + 9999 四位封顶）全部收编进本 patch。
- **方案**：`tpsMeter.ts`（1.5s 滑窗字符估算→token/s，会话结束 2s→0.5s 平均 fallback，稀疏阈值 5 回退保持值）+ `TpsIndicator.tsx`（180ms 轮询、<27红/<53橙/<80绿/≥80紫、5 分钟空闲隐藏、30/70 指数平滑、`vertical` 两行、i18n 5 语言）；chatStore 在 `appendPendingDelta`/`appendPendingToolInputDelta`/`case 'thinking'` 三处喂米表；子代理文本经 `agent_run_event` 在派发前 `ingestSubagentTps` 直接进**父米表**（不新增 WS 帧），下属米表降级为活跃计数来源（避免双计）。
- **验证**：vitest 全量 6141 pass/2 fail（2=基线既有，零回归）；H5 live 实测 thinking 阶段实时 46-116 t/s 持续 24s；WS 探针证实 thinking 100% 流式 delta；21 链 068b3ebd 顺序 apply FAIL=0、8 文件逐字节=工作树。
