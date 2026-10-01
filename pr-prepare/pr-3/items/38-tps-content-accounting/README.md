# 38-tps-content-accounting — TPS 计量改为按内容度量（链位 38，`38-tps-content-accounting.patch`，8 文件 +369/−252）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 38，patch `38-tps-content-accounting.patch`（本目录）

- **问题/需求**（用户 verbatim）：6 个子代理并发时「聚合 TPS 达到 800+，而本地引擎控制台只有 400 左右」。根因：① 全局 `kChunk` 被工具入参密帧（~90-220 token/帧）污染到夹逼上限 8，之后稀疏散文帧（~2.5/帧）按 8 倍计（`100 帧/s × 8 ≈ 800`）；② `ids` 通路实际是死的（主会话请求不带 session 头 → `tps_tokens` 永不发出，探针 0 帧）。
- **方案**：以「内容度量」取代「帧计数」：`tokens ≈ kCjk×CJK字符 + kAscii×非CJK字符/3.5`，文本长度是密度无关的直接测量；两系数从每次调用的（两类单元数，真实 output_tokens）用**最小二乘**（遗忘 0.9，夹逼 [0.25,6]）联合学习，按模型持久化 v2；`ids` 独占（窗口内有 ids 样本就只返回 ids）；删 `kChunk`/混合权重/`'chunk'` 源。引擎口径先做算术核对：541 个 10s 窗口中位比 1.000 证明本机 dflash 配置下 `Avg generation throughput` 已含 accepted，两行相加会重复计（≈1.6×）。
- **验证**：同一会话同一 6 并发场景实测：修复前面板中位 ~800 vs 引擎 290（2.8×）→ 修复后 363 vs 290（1.25×，且该轮 calls=0、系数还是中性 1.0 的最差情形，调用结束学习后应收敛）；tpsMeter 18/tpsCalibration 8/TpsIndicator 5/chatStore 366，受影响四套 397/397。
