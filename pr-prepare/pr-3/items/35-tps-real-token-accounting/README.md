# 35-tps-real-token-accounting — TPS 采样改真实 token 口径——三层源自适应 + 对账校准（链位 35，`35-tps-real-token-accounting.patch`，20 文件 +1184/−52）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 35，patch `35-tps-real-token-accounting.patch`（本目录）

- **问题/需求**（用户 verbatim）：「校正一下 TPS 采样是按实际 token 情况来的还是估算值」→ 核实**一直是字符估算**；要求「不依赖后端引擎自适应：能发 token ids 走 ids；无 ids 走 chunk；再走兜底估算」。实测估算/真实中位比 0.77（偏低约 23%），P90 误差 51.2%。
- **方案**：三层源——`ids`（引擎 `return_token_ids` 经代理旁路 `tps_tokens` WS 送达，免校准；门控：仅本机/私网或 provider 声明 supported 才发请求参数，新增注册式 sink `tpsTokenSink.ts` 断 `ws→titleService→proxy` 成环）/ `chunk`（每帧=1 单位，学 `kChunk`）/ `char`（整块投递按 `estimateTokens`）；每次 `message_complete` 用真实 `output_tokens` **坐标下降**对账校准，按 model 分桶持久化（LRU≤32）；`external` 标记让子代理帧进窗口但不进对账；UI `data-tps-source` 区分精确/校准（非 ids 加 `≈`）。
- **验证**：tpsMeter 15 + tpsCalibration 8 + TpsIndicator 5 + chatStore 366 全绿；`bun test src/server` 3458/0；char 层校准后中位误差 23.6%→14.7%（到不了 ±3%，精确靠 chunk/ids 层）。⚠️ 后续（链位 38）证明 chunk 层设计被替换，但 ids/char 两层与对账框架延续至今。
