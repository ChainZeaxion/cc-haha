# 62-tps-bucket-engine-rewrite — TPS 速率引擎重写为 125ms 分桶（链位 62，`62-tps-bucket-engine-rewrite.patch`，19 文件 +1619/−998）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 62，patch `62-tps-bucket-engine-rewrite.patch`（本目录）

- **问题/需求**（用户 5 条规格 verbatim）：① 每 125ms 收多少 token 除以时间，每秒显示 8 次，第 8 个（整 1s）求 8 桶平均；② 起步第一个 125ms 不直接迸发，等第二个才开始均衡显示；③ 流式结束尾巴与倒数第二个 125ms 均衡显示；④ 结束后速度信息残留 5 分钟，按跨度最大到最近 1500ms 数据求平均；⑤ 引擎发 ids 则优先用精准 ids，拿不到走推断估算。
- **方案**：**推倒旧连续滑窗整块重做**（`sliceRate`/`WINDOW_MS`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindowAt`/`computeFallbackTps`/`sampleTokens` 全删）：`BUCKET_MS=125`/`READ_BUCKETS=8`，**只读已完成桶**（不足 8 桶除以已过桶数）；`MIN_BUCKETS_FOR_READ=2` 起步返回保持值；`settle()` 尾部两桶 50/50 均衡（均值守恒）；结束后 `heldValue` 冻结 5 分钟（引擎真值 `realTokens/decodeSpan` 优先，否则 ≤1500ms 桶平均 `HOLD_BUCKETS=12`）；双钟 `TpsClock='generation'|'arrival'` 默认 generation（⚠️ `serverTs` epoch 与 `performance.now()` 绝不可混算，无戳帧永久降级并重建网格）；空桶计 0、静默 >1.5s 清窗重计；`RING_SIZE=64` 环宽于读数窗以摊平积压（`MAX_BUCKET_TPS=5000`）；指示器 30/70 指数平滑移除（桶平均本身即平滑）。
- **验证**：`tpsMeter.test.ts` 重写 27 例；tpsMeter/tpsCalibration/TpsIndicator 46/46；相关 8 文件 495 测试全绿；时钟纪律 A/B 永久用例（40 帧 5× 排空压缩：生成钟 104 真值 vs 到达钟 >300）；构建后 7788 入口 hash = 仓库 dist。⚠️ 真机观感验证当时未做，后由用户实测确认。
