# 50-tps-phase-switch-steady-window — TPS 相位切换脉冲真根因——分母不覆盖被除的 token（链位 50，`50-tps-phase-switch-steady-window.patch`，2 文件 +156/−53）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 50，patch `50-tps-phase-switch-steady-window.patch`（本目录）

- **问题/需求**（用户 verbatim）：「TPS 还在异常飙升，尤其是动作阶段切换（思考切工具、正文切思考），思考结束后经常夸张飙升到 9999 t/s」+「应该取稳态数据，延迟 0.23s 稳态后再变动」。前置事实：链位 42 的锚已在生产 bundle（非制品陈旧），是锚覆盖不足。
- **方案**：收敛成一条规则落在私有方法 `sliceRate()`：**一批 token 是在它与前一批之间生成的**，切片诚实分母=「切片前一个样本 → 切片最后样本」；无前置样本时丢弃最旧一批而非摊给剩余跨度；整片不可计时返回 `null` → 调用方持有上一个真值。`value()` 只算稳态段（丢比 `now − SETTLE_MS(230ms)` 更新的样本），不再有 `Math.max(span, 400ms)` 造数兜底；`computeFallbackTps` 同规则，0=未测得、不覆盖持有值。
- **验证**：离线 5 场景复现（真值 250）：S2 停顿冲刷 1625→240、S4 整块单样本 22500→0（持有）、S1 稳态 285.7→250.0（旧式系统性偏高 11% 一并消除）；tpsMeter 25/tpsCalibration 8/TpsIndicator 6 = 39 全绿；`tsc -b` 0 错。
