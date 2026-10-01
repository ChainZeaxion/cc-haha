# pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）

## 功能域概述

会话流式输出时在桌面头栏 / 移动端顶栏显示实时解码速度（token/秒），帮助用户感知模型吞吐。本 PR 覆盖该功能从 0.6.6 基座（无任何 TPS 代码）到最终形态的完整迭代史：字符估算米表 → 子代理汇聚 → 真实 token 口径（三层源自适应 + 对账校准）→ 按内容度量 → 多轮脉冲/爆读根因修复 → 最终按用户 5 条规格整块重写为 125ms 固定网格分桶引擎，以及后台标签页冻结场景的收尾修复。

## 演进主线

**第一阶段（链位 7/30）：把指示器做出来并站稳。** 0.6.6 无 TPS 代码，从老 fork 移植 `tpsMeter`（1.5s 滑动窗口，字符估算 CJK≈1 token/字、ASCII≈1/3.5 字）+ `TpsIndicator`（180ms 轮询、四档着色、5 分钟空闲隐藏），接入 chatStore 的 `appendPendingDelta`/`appendPendingToolInputDelta` 两个喂入点，并补齐移动端两行竖排、子代理汇聚（`agent_run_event` 直接喂父米表，修掉「不打开子代理页就完全不计入」的 tab 归属设计错误）、thinking 计入、保持值口径（正文结束前 0.5s 平均）等子优化。链位 30 按用户反馈把「费用上/TPS 下」两行中的 TPS 行由右对齐改居中。

**第二阶段（链位 35/38）：从估算走向真实口径。** 用户核实「TPS 一直是字符估算」后要求自适应真实 token：链位 35 实现三层源（`ids` 精确 / `chunk` 帧计数 / `char` 字符兜底）+ 每次 `message_complete` 用真实 `output_tokens` 坐标下降对账校准 + 引擎 `return_token_ids` 旁路（WS `tps_tokens` 帧、注册式 sink 断环）。实测发现「每帧 token 数」全局系数方案在 6 并发子代理下被工具入参密帧污染（kChunk clamp 到 8），读数 800 vs 引擎真值 290（2.8×）；链位 38 用「按内容度量」整体替换帧计数（`kCjk`/`kAscii` 两系数最小二乘学习，`ids` 独占），修后同场景 363 vs 290（1.25×，残余即语料真实 CJK 密度与中性值之差）。

**第三阶段（链位 42/44/50/54）：连修四轮「读数爆炸」根因。** 每轮都是生产实测爆读 → 离线复现 → 修单点，且**每轮都是独立的真因**：① 流切换处窗口塌缩、积压 token 被 400ms 地板除（生产 1000-2000 t/s，真值 230-280）→ 加「刚滑出窗口的样本」锚 `preWindowAt`；② 思考徽章取不到精确单块 token → `tps_tokens` 带 kind + 代理透传 `reasoning_tokens`；③ 相位切换 9999 脉冲 → `total` 与 `span` 不是同一批 token 的时间（锚条件太窄/无前置样本凭空造 400ms 分母）→ 收敛成 `sliceRate()` 单条规则「一批 token 在其与前一批之间生成」，只算稳态段；④ 上千读数（尤其 bash 时）→ 打包投递（重放/整块交付/页面忙时排队帧）被当成生成节奏 → 逐样本只计入「到达间隔能支撑其实时速率」的样本（上限 5000）。

**第四阶段（链位 62/64）：推倒重来 + 收尾。** 用户给出 5 条明确规格（125ms 分桶 / 起步延迟 / 尾部 50-50 均衡 / 结束后保持 / ids 优先），旧连续滑窗的所有机制（`sliceRate`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindowAt` 等）全部删除，换成固定网格分桶引擎；链位 64 修后台标签页节流切回后「飙高+卡住」同源问题（积压同瞬间落进同一个 125ms 桶）。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. TPS 指示器基础 + 子代理汇聚 + 展示格式（链位 7，`07-tps-indicator.patch`，8 文件 +776/−7）

- **问题/需求**：流式输出时显示实时解码速度；移动端顶栏空间有限需两行竖排。0.6.6 无任何 TPS 代码。后续多轮子优化（起步速度修正 `BURST_FLOOR_MS=400` 防突发虚高 2000→~75、thinking 计入 TPS、保持值口径改为正文结束前 0.5s 平均、子代理汇聚到主会话并标 `Σn` 徽章、`TPS XXt/s` 格式 + 9999 四位封顶）全部收编进本 patch。
- **方案**：`tpsMeter.ts`（1.5s 滑窗字符估算→token/s，会话结束 2s→0.5s 平均 fallback，稀疏阈值 5 回退保持值）+ `TpsIndicator.tsx`（180ms 轮询、<27红/<53橙/<80绿/≥80紫、5 分钟空闲隐藏、30/70 指数平滑、`vertical` 两行、i18n 5 语言）；chatStore 在 `appendPendingDelta`/`appendPendingToolInputDelta`/`case 'thinking'` 三处喂米表；子代理文本经 `agent_run_event` 在派发前 `ingestSubagentTps` 直接进**父米表**（不新增 WS 帧），下属米表降级为活跃计数来源（避免双计）。
- **验证**：vitest 全量 6141 pass/2 fail（2=基线既有，零回归）；H5 live 实测 thinking 阶段实时 46-116 t/s 持续 24s；WS 探针证实 thinking 100% 流式 delta；21 链 068b3ebd 顺序 apply FAIL=0、8 文件逐字节=工作树。

### 2. 费用/TPS 保持两行，TPS 第二行居中（链位 30，`30-tps-centered-second-line.patch`，2 文件 +6/−3）

- **问题/需求**（用户 verbatim 意译）：费用信息宽度充足，其下方的 TPS 右对齐显得不对仗，应改为两行中 TPS 第二行**居中**显示。
- **方案**：仅改水平对齐——桌面 `ActiveSession.tsx` 与 H5 `AppShell.tsx` 外层 `flex-col items-end` → `items-center`；「上=费用、下=TPS」双行结构保留，`<TpsIndicator vertical />` 保留。外层宽度由最宽子项（费用徽章）决定，较窄的 TPS 行在费用徽章正下方居中。
- **验证**：TpsIndicator(4) + AppShell + ActiveSession(34) 三文件 vitest 60/60 全绿；35 链中该 patch 2 文件与工作树逐字节一致。

### 3. TPS 采样改真实 token 口径——三层源自适应 + 对账校准（链位 35，`35-tps-real-token-accounting.patch`，20 文件 +1184/−52）

- **问题/需求**（用户 verbatim）：「校正一下 TPS 采样是按实际 token 情况来的还是估算值」→ 核实**一直是字符估算**；要求「不依赖后端引擎自适应：能发 token ids 走 ids；无 ids 走 chunk；再走兜底估算」。实测估算/真实中位比 0.77（偏低约 23%），P90 误差 51.2%。
- **方案**：三层源——`ids`（引擎 `return_token_ids` 经代理旁路 `tps_tokens` WS 送达，免校准；门控：仅本机/私网或 provider 声明 supported 才发请求参数，新增注册式 sink `tpsTokenSink.ts` 断 `ws→titleService→proxy` 成环）/ `chunk`（每帧=1 单位，学 `kChunk`）/ `char`（整块投递按 `estimateTokens`）；每次 `message_complete` 用真实 `output_tokens` **坐标下降**对账校准，按 model 分桶持久化（LRU≤32）；`external` 标记让子代理帧进窗口但不进对账；UI `data-tps-source` 区分精确/校准（非 ids 加 `≈`）。
- **验证**：tpsMeter 15 + tpsCalibration 8 + TpsIndicator 5 + chatStore 366 全绿；`bun test src/server` 3458/0；char 层校准后中位误差 23.6%→14.7%（到不了 ±3%，精确靠 chunk/ids 层）。⚠️ 后续（链位 38）证明 chunk 层设计被替换，但 ids/char 两层与对账框架延续至今。

### 4. TPS 计量改为按内容度量（链位 38，`38-tps-content-accounting.patch`，8 文件 +369/−252）

- **问题/需求**（用户 verbatim）：6 个子代理并发时「聚合 TPS 达到 800+，而本地引擎控制台只有 400 左右」。根因：① 全局 `kChunk` 被工具入参密帧（~90-220 token/帧）污染到夹逼上限 8，之后稀疏散文帧（~2.5/帧）按 8 倍计（`100 帧/s × 8 ≈ 800`）；② `ids` 通路实际是死的（主会话请求不带 session 头 → `tps_tokens` 永不发出，探针 0 帧）。
- **方案**：以「内容度量」取代「帧计数」：`tokens ≈ kCjk×CJK字符 + kAscii×非CJK字符/3.5`，文本长度是密度无关的直接测量；两系数从每次调用的（两类单元数，真实 output_tokens）用**最小二乘**（遗忘 0.9，夹逼 [0.25,6]）联合学习，按模型持久化 v2；`ids` 独占（窗口内有 ids 样本就只返回 ids）；删 `kChunk`/混合权重/`'chunk'` 源。引擎口径先做算术核对：541 个 10s 窗口中位比 1.000 证明本机 dflash 配置下 `Avg generation throughput` 已含 accepted，两行相加会重复计（≈1.6×）。
- **验证**：同一会话同一 6 并发场景实测：修复前面板中位 ~800 vs 引擎 290（2.8×）→ 修复后 363 vs 290（1.25×，且该轮 calls=0、系数还是中性 1.0 的最差情形，调用结束学习后应收敛）；tpsMeter 18/tpsCalibration 8/TpsIndicator 5/chatStore 366，受影响四套 397/397。

### 5. TPS 脉冲修复——滑出窗口样本锚（链位 42，`42-tps-burst-anchor.patch`，2 文件 +175/−5）

- **问题/需求**：流切换（text↔thinking↔tool）处窗口塌缩，积压 token 被 400ms 地板除 ⇒ **生产实测爆到 1000-2000 t/s（真值 230-280，4-7×）**。
- **方案**：`value()` 补「刚滑出窗口的样本」锚 `preWindowAt`（`prune()` 留下该样本作为切片时间原点），使积压被摊到其真实跨越的停顿上而非 400ms 地板；附估算校准接线 `setEstimationCalibration`。
- **验证**：生产 bundle 实测含 `preWindowAt` 符号后脉冲消失（同时坐实此前修法只在工作区、从未进过 deb 的「制品新鲜度」教训）。⚠️ 该锚条件后来被证明**太窄**（`span < 400ms` 恰好漏掉 `span == 400ms` 的停滞冲刷），由链位 50 的 `sliceRate()` 规则取代，链位 62 整块重写时删除。

### 6. `tps_tokens` 带 kind + 代理透传 `reasoning_tokens`（链位 44，`44-tps-tokens-kind-and-reasoning-passthrough.patch`，12 文件 +232/−30）

- **问题/需求**：思考徽章要取**精确单块** thinking token，但转录无此字段（只能估）；`tps_tokens` 原只带总量，无法区分 thinking/content/tool。
- **方案**：`tps_tokens` WS 帧的 token 计数带 **kind**（thinking/content/tool），思考徽章据此取精确单块；代理层透传 `reasoning_tokens`（兼容 vLLM `completion_tokens_details` 与 Responses `output_tokens_details` 两种形状）。
- **验证**：本 patch 为链终态→工作树干净差分，链重放 0 失败；kind 拆分与 reasoning 透传在思考徽章（pr-9 思考计时族）与用量拆分（pr-10 子代理用量族）中被下游消费，端到端数字与引擎日志核对一致。

### 7. TPS 相位切换脉冲真根因——分母不覆盖被除的 token（链位 50，`50-tps-phase-switch-steady-window.patch`，2 文件 +156/−53）

- **问题/需求**（用户 verbatim）：「TPS 还在异常飙升，尤其是动作阶段切换（思考切工具、正文切思考），思考结束后经常夸张飙升到 9999 t/s」+「应该取稳态数据，延迟 0.23s 稳态后再变动」。前置事实：链位 42 的锚已在生产 bundle（非制品陈旧），是锚覆盖不足。
- **方案**：收敛成一条规则落在私有方法 `sliceRate()`：**一批 token 是在它与前一批之间生成的**，切片诚实分母=「切片前一个样本 → 切片最后样本」；无前置样本时丢弃最旧一批而非摊给剩余跨度；整片不可计时返回 `null` → 调用方持有上一个真值。`value()` 只算稳态段（丢比 `now − SETTLE_MS(230ms)` 更新的样本），不再有 `Math.max(span, 400ms)` 造数兜底；`computeFallbackTps` 同规则，0=未测得、不覆盖持有值。
- **验证**：离线 5 场景复现（真值 250）：S2 停顿冲刷 1625→240、S4 整块单样本 22500→0（持有）、S1 稳态 285.7→250.0（旧式系统性偏高 11% 一并消除）；tpsMeter 25/tpsCalibration 8/TpsIndicator 6 = 39 全绿；`tsc -b` 0 错。

### 8. TPS 上千读数——打包投递被当成生成节奏（链位 54，`54-tps-batched-delivery.patch`，4 文件 +209/−16）

- **问题/需求**（用户 verbatim）：「TPS 数据还是冲上 1600 了，尤其在执行 bash 动作时」。关键推断：bash 期间流是停的、显示的是持有值 ⇒ 前两轮修正都没触到这条路径——token 的**生成时刻**远早于**投递时刻**（重放/非流式整块交付/页面忙时排队的中转帧，bash 大量输出正好占满主线程）。
- **方案**：`sliceRate()` 内**逐样本**只计入「按到达间隔算出的瞬时速率可能真实成立」的样本（上限 `MAX_INSTANT_TPS=5000`，本地引擎实测 ~250、最快配置 <1000）；延迟交付的**第一批保留自己的大间隔**（积压仍按真实停顿评级），其余批次不计入而非摊给最近区间；`formatTps` 导出、9999 封顶降级为纯显示层兜底。
- **验证**：离线（真值 250）：整块重放 7153.8→250.0、工具停顿后突发 3602.9→383.1（非 0，首批如实计入）、稳态 250.0 不变；tpsMeter 27/tpsCalibration 8/TpsIndicator 7 = 42 全绿；`tsc -b` 0 错。

### 9. TPS 速率引擎重写为 125ms 分桶（链位 62，`62-tps-bucket-engine-rewrite.patch`，19 文件 +1619/−998）

- **问题/需求**（用户 5 条规格 verbatim）：① 每 125ms 收多少 token 除以时间，每秒显示 8 次，第 8 个（整 1s）求 8 桶平均；② 起步第一个 125ms 不直接迸发，等第二个才开始均衡显示；③ 流式结束尾巴与倒数第二个 125ms 均衡显示；④ 结束后速度信息残留 5 分钟，按跨度最大到最近 1500ms 数据求平均；⑤ 引擎发 ids 则优先用精准 ids，拿不到走推断估算。
- **方案**：**推倒旧连续滑窗整块重做**（`sliceRate`/`WINDOW_MS`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindowAt`/`computeFallbackTps`/`sampleTokens` 全删）：`BUCKET_MS=125`/`READ_BUCKETS=8`，**只读已完成桶**（不足 8 桶除以已过桶数）；`MIN_BUCKETS_FOR_READ=2` 起步返回保持值；`settle()` 尾部两桶 50/50 均衡（均值守恒）；结束后 `heldValue` 冻结 5 分钟（引擎真值 `realTokens/decodeSpan` 优先，否则 ≤1500ms 桶平均 `HOLD_BUCKETS=12`）；双钟 `TpsClock='generation'|'arrival'` 默认 generation（⚠️ `serverTs` epoch 与 `performance.now()` 绝不可混算，无戳帧永久降级并重建网格）；空桶计 0、静默 >1.5s 清窗重计；`RING_SIZE=64` 环宽于读数窗以摊平积压（`MAX_BUCKET_TPS=5000`）；指示器 30/70 指数平滑移除（桶平均本身即平滑）。
- **验证**：`tpsMeter.test.ts` 重写 27 例；tpsMeter/tpsCalibration/TpsIndicator 46/46；相关 8 文件 495 测试全绿；时钟纪律 A/B 永久用例（40 帧 5× 排空压缩：生成钟 104 真值 vs 到达钟 >300）；构建后 7788 入口 hash = 仓库 dist。⚠️ 真机观感验证当时未做，后由用户实测确认。

### 10. 后台标签页切回后 TPS 飙高 / 卡着不动（链位 64，`64-tps-background-freeze.patch`，4 文件 +244/−11）

- **问题/需求**（用户 verbatim）：浏览器缩小切出去一段时间再切回，TPS 要么飙高、要么一直卡着不动。根因：后台节流使帧不处理而引擎照常产出，切回时整段积压**同一瞬间**落进同一个到达 125ms 桶；长静默清空环后 `depileBucket` 找不到可归属区间（`previous === -1`）不摊平 ⇒ 整段积压按一个 125ms 计费（60s 冻结 ⇒ 6240 token/桶 ≈ 50k t/s）。
- **方案**（全客户端）：① 无可归属区间的积压桶**丢弃而非摊平**（两种不可测情形）；② 丢弃粘性（`Bucket.dropped`）防后续 token 重建；③ 丢弃桶**不进分母**（空桶仍计 0，暂停如实读成凹陷）；④ 跨静默前把最后读数记入 `heldValue`，`settle()` 不用 0 覆盖真读数；⑤ 指示器防闪保持改**有界** `HOLD_UNCHANGED_MAX_MS=1500`（原无界保持把任何持续慢速冻结在旧值上）。
- **验证**：离线实测（真值 104、冻结 60s）到达钟序列「0 → 25,012 → 逐拍衰减 → 104」坐实「先 0 后被防闪规则无限期冻结、紧接着巨桶进窗」两端同源；修复后生成钟全程 104；新用例还原源码后分别以 6331/0 失败（证明修前会失败）；tpsMeter 27→31、TpsIndicator 11→12，相关 6 套件 669/669；`src/` 零改动；链复现度 64/64 apply 0 失败。

## 验证口径（组级）

- **链复现度**：干净 worktree@`068b3ebd` 按链序（1→64）`git apply --allow-empty` ⇒ **64/64 失败 0**；`git write-tree` 与工作树比对，差异仅 `bun.lock` 与 `desktop/src-tauri/resources/preview-agent.js` 两个有意排除项（+ `modify/` 元数据）。
- **单测基线**：本组直接改动的测试文件 `tpsMeter.test.ts`（终态 31 例）/ `tpsCalibration.test.ts` / `TpsIndicator.test.tsx`（12）/ `chatStore.test.ts`（380）/ 服务端 `proxy-transform.test.ts` 等；权威口径 `bun run check:server`（492+ 文件全绿基线）与桌面 `tsc --noEmit` / 全量 vitest（既有 2 fail 为基线 providerModels、MessagePayloadRetention，非回归）。
- **实测对照**：所有爆读修复均以「离线复现表（改前/改后）+ 引擎日志真值」双证；引擎真值口径 = `G27.log` 的 `Avg generation throughput`（541 窗口算术核对中位比 1.000 已证含 accepted，**不可两行相加**）。
- ⚠️ 注意：文档中部分小节的链位编号（52/56）与本组 manifest 编号（50/54）差 2，系链中途插入其他组 patch 所致；以 manifest 表为准。

## 与其他组的关系

- **pr-10（子代理用量一致性）**：依赖本组的 `tps_tokens` 帧与 chatStore 子代理米表喂入路径（`ingestSubagentTps`）；其思考徽章/组栏实时跟进消费本组链位 44 的 **kind 拆分**与 `reasoning_tokens` 透传。
- **pr-9（思考计时族）**：思考徽章的精确单块 thinking token 来自本组链位 44 的 `tps_tokens` kind 字段（转录无此字段）。
- **依赖补齐文件**（manifest 中「链内被其他组改动/新增的传递依赖」，如 `sessions.ts`/`subagents.ts`/`MessageList.tsx`/`ThinkingBlock.tsx`/`sessionUsageMetrics.ts` 等）：本组 patch 的 hunk 上下文依赖这些文件在本链前序状态；跨组拆 PR 时若上游版本不一致，需按「树对树」方式核对（见风险）。

## 风险与备注

- **⚠️ 上游冲突风险文件**（manifest 标注「上游 main 也改过」）：`desktop/src/pages/ActiveSession.tsx`、`desktop/src/stores/chatStore.ts`、`desktop/src/stores/chatStore.test.ts`、`desktop/src/types/chat.ts`、`desktop/src/components/chat/MessageList.tsx`、`src/server/index.ts`、`src/server/proxy/handler.ts`、`src/server/proxy/streaming/openaiChatStreamToAnthropic.ts`（+其测试）、`src/server/types/provider.ts`、`src/server/ws/events.ts`、`src/server/ws/handler.ts`、`src/server/__tests__/websocket-handler.test.ts`，以及 i18n 5 语言文件（`en/zh/zh-TW/jp/kr.ts`）。合并上游后需按树对树（`write-tree`+`diff-tree`）重验 64 链。
- **评审重点（引擎重写，链位 62，本组最大 diff +1619/−998）**：
  1. 双钟纪律：`serverTs`（epoch）与 `performance.now()`（单调钟）不可混算；时钟选择对每个米表**粘性**，无戳帧永久降级并重建网格——这是移动端 1000+ 爆读的同源问题。
  2. **只读已完成桶**（进行中的桶计入会把 104 读成 91）；环（64 桶=8s）必须远宽于读数窗（8 桶=1s），否则积压摊平均值守恒、等于没做。
  3. `endCall` 不能标记「已结束」（轮内多次 API 调用），终态靠 `endStream()` + 静默隐含结束。
  4. 均值守恒的 `settle()` 50/50 均衡是用户按字面要求（只改分布不改读数），非性能手段。
  5. 真机观感验证当时缺位（无 playwright，H5 SPA 长连接 headless 挂住），以用户实测收尾——PR 描述中应注明。
- **口径诚实性**：char/内容度量层校准后中位误差 ~14.7%（到不了 ±3%，分词器细节不可还原）；速度指示器 ±20-30% 可接受，精确靠 ids 层（引擎支持时）；子代理拿不到真实 usage/ids，其贡献只能套父会话同模型系数。
- **i18n 键稳定性**：`chat.tpsAggregateTitle` 插在 `chat.tpsSpeedTitle` 后，曾连锁重生成下游锚定该区域的 patch（file-download/h5-mobile-quick-actions）——上游若动 i18n 该区需一并核对。
- **建议分支**：`pr/tps-indicator`。
