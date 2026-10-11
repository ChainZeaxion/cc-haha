# 42-tps-burst-anchor — TPS 脉冲修复——滑出窗口样本锚（链位 42，`42-tps-burst-anchor.patch`，2 文件 +175/−5）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 42，patch `42-tps-burst-anchor.patch`（本目录）

- **问题/需求**：流切换（text↔thinking↔tool）处窗口塌缩，积压 token 被 400ms 地板除 ⇒ **生产实测爆到 1000-2000 t/s（真值 230-280，4-7×）**。
- **方案**：`value()` 补「刚滑出窗口的样本」锚 `preWindowAt`（`prune()` 留下该样本作为切片时间原点），使积压被摊到其真实跨越的停顿上而非 400ms 地板；附估算校准接线 `setEstimationCalibration`。
- **验证**：生产 bundle 实测含 `preWindowAt` 符号后脉冲消失（同时坐实此前修法只在工作区、从未进过 deb 的「制品新鲜度」教训）。⚠️ 该锚条件后来被证明**太窄**（`span < 400ms` 恰好漏掉 `span == 400ms` 的停滞冲刷），由链位 50 的 `sliceRate()` 规则取代，链位 62 整块重写时删除。
