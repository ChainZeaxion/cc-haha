# tps-indicator — TPS 指示器基础 + 子代理汇聚 + 展示格式 + 多轮脉冲修复（原链位 7,30,35,38,42,44,50,54）

> 功能主题：`tps` — TPS 实时解码速度指示器（`pr-prepare/tps/`）｜ PR 分支 `tps-indicator`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/tps/tps-indicator-patch1.patch`（25 文件 +2743−14）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 7 | `tps-indicator` | 四 TPS 指示器 + 两行 + 子代理汇聚 + 展示格式/4 位封顶（#90） |
| 30 | `tps-centered-second-line` | 四 费用/TPS **保持上下两行**，TPS 由右对齐改**第二行居中**（桌面 `ActiveSession.tsx` + H5 `AppShell.tsx`） |
| 35 | `tps-real-token-accounting` | 四 子优化：**TPS 采样改真实 token 口径**——自适应三层源（ids/chunk/char）+ 真实 `output_tokens` 对账校准 + 按模型分桶持久化 + 引擎 `return_token_ids` 旁路（20 文件 1717 行） |
| 38 | `tps-content-accounting` | 四 子优化：**TPS 计量改为按内容度量**（CJK/latin 两系数最小二乘 + `ids` 独占；废弃按帧计数的 chunk 层——6 并发子代理下它把读数抬到真实值 2~3 倍的根因） |
| 42 | `tps-burst-anchor` | 四 子优化⑤：**TPS 脉冲修复**——`value()` 缺「刚滑出窗口的样本」锚（`preWindowAt`），流切换处窗口塌缩时积压 token 被 400ms 地板除 ⇒ 生产实测爆到 1000-2000 t/s（真值 230-280，4-7×）；附估算校准接线 `setEstimationCalibration`（2 文件 175 增） |
| 44 | `tps-tokens-kind-and-reasoning-passthrough` | 四 子优化⑥：`tps_tokens` 带 **kind**（thinking/content/tool）供思考徽章取**精确单块** token（转录无此字段，只能估）；代理层透传 `reasoning_tokens`（兼容 vLLM `completion_tokens_details` 与 Responses `output_tokens_details`，12 文件 232 增） |
| 50 | `tps-phase-switch-steady-window` | 四 子优化⑦：**TPS 相位切换脉冲真根因**——`total` 与 `span` 不是同一批 token 的时间：锚的条件太窄（停滞冲刷恰落在 `span==400ms` 地板故不进锚）、无前置样本时 `Math.max(span, 400ms)` 凭空造分母（整块交付读 22500）、`computeFallbackTps` 同病。收敛为一条规则：**一批 token 生成于它与前一批之间**（`sliceRate()`：原点取切片前一样本；无前置则丢弃最旧那批；不可计时则持有）。顺带修正稳态读数**系统性偏高 11%**（10 批除 9 个间隔） |
| 54 | `tps-batched-delivery` | 四 补记二：**TPS 上千读数真因＝打包投递被当成生成节奏**——重放/整块交付/页面忙时排队的中转帧，其 token 生成时刻远早于投递时刻；逐样本只计入「到达间隔能支撑其实时速率」的样本（上限 5000），延迟交付的首批保留自身间隔故积压仍按其真实停顿评级。实测 7153→250、3603→383（4 文件）。**2026-09-29 修订（187→316 行）**：原过滤按「距**上一个样本**的间隔」判定，隐含**单流前提**；子代理文本折进父米表同一 `samples` 数组后多流交织（帧间隔中位数 0.246ms、66.5% <1ms），正常的 5 单位分片落在别的流之后 0.5ms 即算出 10000 t/s 而被当作「批量投递」丢弃，**实测丢弃 70–73%**，4 子代理并发时 UI 读数仅引擎真值的 1/3。改为**按流间隔**（`Sample.stream` + `ingestSubagentTps` 传 `runAgentId`；窗口内首样本回退 `origin` 保守保留），离线重放 74.7 → **244.5**（无过滤上限 252.7），端到端逐秒对齐。防「批量重放」的原意完整保留。4 文件 |

## 明细

### 原链位 7 — `tps-indicator`

- **问题/需求**：流式输出时显示实时解码速度；移动端顶栏空间有限需两行竖排。0.6.6 无任何 TPS 代码。后续多轮子优化（起步速度修正 `BURST_FLOOR_MS=400` 防突发虚高 2000→~75、thinking 计入 TPS、保持值口径改为正文结束前 0.5s 平均、子代理汇聚到主会话并标 `Σn` 徽章、`TPS XXt/s` 格式 + 9999 四位封顶）全部收编进本 patch。
- **方案**：`tpsMeter.ts`（1.5s 滑窗字符估算→token/s，会话结束 2s→0.5s 平均 fallback，稀疏阈值 5 回退保持值）+ `TpsIndicator.tsx`（180ms 轮询、<27红/<53橙/<80绿/≥80紫、5 分钟空闲隐藏、30/70 指数平滑、`vertical` 两行、i18n 5 语言）；chatStore 在 `appendPendingDelta`/`appendPendingToolInputDelta`/`case 'thinking'` 三处喂米表；子代理文本经 `agent_run_event` 在派发前 `ingestSubagentTps` 直接进**父米表**（不新增 WS 帧），下属米表降级为活跃计数来源（避免双计）。
- **验证**：vitest 全量 6141 pass/2 fail（2=基线既有，零回归）；H5 live 实测 thinking 阶段实时 46-116 t/s 持续 24s；WS 探针证实 thinking 100% 流式 delta；21 链 068b3ebd 顺序 apply FAIL=0、8 文件逐字节=工作树。

### 原链位 30 — `tps-centered-second-line`

- **问题/需求**（用户 verbatim 意译）：费用信息宽度充足，其下方的 TPS 右对齐显得不对仗，应改为两行中 TPS 第二行**居中**显示。
- **方案**：仅改水平对齐——桌面 `ActiveSession.tsx` 与 H5 `AppShell.tsx` 外层 `flex-col items-end` → `items-center`；「上=费用、下=TPS」双行结构保留，`<TpsIndicator vertical />` 保留。外层宽度由最宽子项（费用徽章）决定，较窄的 TPS 行在费用徽章正下方居中。
- **验证**：TpsIndicator(4) + AppShell + ActiveSession(34) 三文件 vitest 60/60 全绿；35 链中该 patch 2 文件与工作树逐字节一致。

### 原链位 35 — `tps-real-token-accounting`

- **问题/需求**（用户 verbatim）：「校正一下 TPS 采样是按实际 token 情况来的还是估算值」→ 核实**一直是字符估算**；要求「不依赖后端引擎自适应：能发 token ids 走 ids；无 ids 走 chunk；再走兜底估算」。实测估算/真实中位比 0.77（偏低约 23%），P90 误差 51.2%。
- **方案**：三层源——`ids`（引擎 `return_token_ids` 经代理旁路 `tps_tokens` WS 送达，免校准；门控：仅本机/私网或 provider 声明 supported 才发请求参数，新增注册式 sink `tpsTokenSink.ts` 断 `ws→titleService→proxy` 成环）/ `chunk`（每帧=1 单位，学 `kChunk`）/ `char`（整块投递按 `estimateTokens`）；每次 `message_complete` 用真实 `output_tokens` **坐标下降**对账校准，按 model 分桶持久化（LRU≤32）；`external` 标记让子代理帧进窗口但不进对账；UI `data-tps-source` 区分精确/校准（非 ids 加 `≈`）。
- **验证**：tpsMeter 15 + tpsCalibration 8 + TpsIndicator 5 + chatStore 366 全绿；`bun test src/server` 3458/0；char 层校准后中位误差 23.6%→14.7%（到不了 ±3%，精确靠 chunk/ids 层）。⚠️ 后续（链位 38）证明 chunk 层设计被替换，但 ids/char 两层与对账框架延续至今。

### 原链位 38 — `tps-content-accounting`

- **问题/需求**（用户 verbatim）：6 个子代理并发时「聚合 TPS 达到 800+，而本地引擎控制台只有 400 左右」。根因：① 全局 `kChunk` 被工具入参密帧（~90-220 token/帧）污染到夹逼上限 8，之后稀疏散文帧（~2.5/帧）按 8 倍计（`100 帧/s × 8 ≈ 800`）；② `ids` 通路实际是死的（主会话请求不带 session 头 → `tps_tokens` 永不发出，探针 0 帧）。
- **方案**：以「内容度量」取代「帧计数」：`tokens ≈ kCjk×CJK字符 + kAscii×非CJK字符/3.5`，文本长度是密度无关的直接测量；两系数从每次调用的（两类单元数，真实 output_tokens）用**最小二乘**（遗忘 0.9，夹逼 [0.25,6]）联合学习，按模型持久化 v2；`ids` 独占（窗口内有 ids 样本就只返回 ids）；删 `kChunk`/混合权重/`'chunk'` 源。引擎口径先做算术核对：541 个 10s 窗口中位比 1.000 证明本机 dflash 配置下 `Avg generation throughput` 已含 accepted，两行相加会重复计（≈1.6×）。
- **验证**：同一会话同一 6 并发场景实测：修复前面板中位 ~800 vs 引擎 290（2.8×）→ 修复后 363 vs 290（1.25×，且该轮 calls=0、系数还是中性 1.0 的最差情形，调用结束学习后应收敛）；tpsMeter 18/tpsCalibration 8/TpsIndicator 5/chatStore 366，受影响四套 397/397。

### 原链位 42 — `tps-burst-anchor`

- **问题/需求**：流切换（text↔thinking↔tool）处窗口塌缩，积压 token 被 400ms 地板除 ⇒ **生产实测爆到 1000-2000 t/s（真值 230-280，4-7×）**。
- **方案**：`value()` 补「刚滑出窗口的样本」锚 `preWindowAt`（`prune()` 留下该样本作为切片时间原点），使积压被摊到其真实跨越的停顿上而非 400ms 地板；附估算校准接线 `setEstimationCalibration`。
- **验证**：生产 bundle 实测含 `preWindowAt` 符号后脉冲消失（同时坐实此前修法只在工作区、从未进过 deb 的「制品新鲜度」教训）。⚠️ 该锚条件后来被证明**太窄**（`span < 400ms` 恰好漏掉 `span == 400ms` 的停滞冲刷），由链位 50 的 `sliceRate()` 规则取代，链位 62 整块重写时删除。

### 原链位 44 — `tps-tokens-kind-and-reasoning-passthrough`

- **问题/需求**：思考徽章要取**精确单块** thinking token，但转录无此字段（只能估）；`tps_tokens` 原只带总量，无法区分 thinking/content/tool。
- **方案**：`tps_tokens` WS 帧的 token 计数带 **kind**（thinking/content/tool），思考徽章据此取精确单块；代理层透传 `reasoning_tokens`（兼容 vLLM `completion_tokens_details` 与 Responses `output_tokens_details` 两种形状）。
- **验证**：本 patch 为链终态→工作树干净差分，链重放 0 失败；kind 拆分与 reasoning 透传在思考徽章（pr-9 思考计时族）与用量拆分（pr-10 子代理用量族）中被下游消费，端到端数字与引擎日志核对一致。

### 原链位 50 — `tps-phase-switch-steady-window`

- **问题/需求**（用户 verbatim）：「TPS 还在异常飙升，尤其是动作阶段切换（思考切工具、正文切思考），思考结束后经常夸张飙升到 9999 t/s」+「应该取稳态数据，延迟 0.23s 稳态后再变动」。前置事实：链位 42 的锚已在生产 bundle（非制品陈旧），是锚覆盖不足。
- **方案**：收敛成一条规则落在私有方法 `sliceRate()`：**一批 token 是在它与前一批之间生成的**，切片诚实分母=「切片前一个样本 → 切片最后样本」；无前置样本时丢弃最旧一批而非摊给剩余跨度；整片不可计时返回 `null` → 调用方持有上一个真值。`value()` 只算稳态段（丢比 `now − SETTLE_MS(230ms)` 更新的样本），不再有 `Math.max(span, 400ms)` 造数兜底；`computeFallbackTps` 同规则，0=未测得、不覆盖持有值。
- **验证**：离线 5 场景复现（真值 250）：S2 停顿冲刷 1625→240、S4 整块单样本 22500→0（持有）、S1 稳态 285.7→250.0（旧式系统性偏高 11% 一并消除）；tpsMeter 25/tpsCalibration 8/TpsIndicator 6 = 39 全绿；`tsc -b` 0 错。

### 原链位 54 — `tps-batched-delivery`

- **问题/需求**（用户 verbatim）：「TPS 数据还是冲上 1600 了，尤其在执行 bash 动作时」。关键推断：bash 期间流是停的、显示的是持有值 ⇒ 前两轮修正都没触到这条路径——token 的**生成时刻**远早于**投递时刻**（重放/非流式整块交付/页面忙时排队的中转帧，bash 大量输出正好占满主线程）。
- **方案**：`sliceRate()` 内**逐样本**只计入「按到达间隔算出的瞬时速率可能真实成立」的样本（上限 `MAX_INSTANT_TPS=5000`，本地引擎实测 ~250、最快配置 <1000）；延迟交付的**第一批保留自己的大间隔**（积压仍按真实停顿评级），其余批次不计入而非摊给最近区间；`formatTps` 导出、9999 封顶降级为纯显示层兜底。
- **验证**：离线（真值 250）：整块重放 7153.8→250.0、工具停顿后突发 3602.9→383.1（非 0，首批如实计入）、稳态 250.0 不变；tpsMeter 27/tpsCalibration 8/TpsIndicator 7 = 42 全绿；`tsc -b` 0 错。
