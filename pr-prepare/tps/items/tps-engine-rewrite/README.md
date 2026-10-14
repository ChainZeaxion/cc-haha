# tps-engine-rewrite — 125ms 分桶引擎重写 + 后台冻结 + 引擎 token ids + 4Hz 读数（原链位 62,64,65,67）

> 功能主题：`tps` — TPS 实时解码速度指示器（`pr-prepare/tps/`）｜ PR 分支 `tps-indicator`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/tps/tps-engine-rewrite-patch1.patch`（25 文件 +2269−1002）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 62 | `tps-bucket-engine-rewrite` | 二十八 28.1：**TPS 速率引擎重写为 125ms 分桶**——按用户 5 条规格推倒旧连续滑窗（`sliceRate`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindowAt` 等**整块删除**）：每 125ms 一桶、显示＝最近 8 桶均值（每秒 8 次，**只读已完成桶**，不足 8 桶除以已过桶数）、首桶不单独显示、末桶与倒数第二桶 50/50、结束后保持 5 分钟（**引擎真值优先**，否则 ≤1500ms 桶平均）、**生成钟优先到达钟兜底**。⚠️ 两钟**绝不可混算**（`serverTs` epoch vs `performance.now`），且时钟选择对每个米表**粘性**（收到无戳帧即永久降级）。实测：稳定 104 若把进行中的桶计入会被读成 **91**；环宽（64×125ms）才能让积压摊平生效（1200 单桶 9600→~1210）（19 文件） |
| 64 | `tps-background-freeze` | 二十八 28.4：**后台标签页切回后 TPS 飙高 / 卡着不动**——浏览器后台节流 JS，切回时整段积压**在同一瞬间交付**，落进同一个到达 125ms 桶（60s 冻结 ⇒ 6240 token/桶 ≈ 单桶 50k t/s）；而摊平只在**环内能找到更早有内容桶**时才做 ⇒ 长静默清环后 `previous === -1` 被当成「run 起点」**不摊平** ⇒ 整段按一个桶计费。实测读数序列 **0 → 25,012 → 16,709 → … → 6,331 → 104**：**「卡住」＝先读出 0 而被指示器的防闪规则无限期冻结，「飙高」＝紧随其后的巨桶**，同源。修法：无可归属区间的积压桶**丢弃**（并粘性化，防几单位几单位重建）+ 丢弃桶**不进分母**（是「没测到」不是「空 125ms」）+ 跨静默**保留最后读数**（`settle()` 不再用 0 覆盖）+ 指示器防闪保持**改为有界 1.5s**（无界会让任何持续 <0.5 t/s 的真实慢速冻住数字）（4 文件） |
| 65 | `—` | （链位 65+ 新增，无旧 item） |
| 67 | `—` | （链位 65+ 新增，无旧 item） |

## 明细

### 原链位 62 — `tps-bucket-engine-rewrite`

- **问题/需求**（用户 5 条规格 verbatim）：① 每 125ms 收多少 token 除以时间，每秒显示 8 次，第 8 个（整 1s）求 8 桶平均；② 起步第一个 125ms 不直接迸发，等第二个才开始均衡显示；③ 流式结束尾巴与倒数第二个 125ms 均衡显示；④ 结束后速度信息残留 5 分钟，按跨度最大到最近 1500ms 数据求平均；⑤ 引擎发 ids 则优先用精准 ids，拿不到走推断估算。
- **方案**：**推倒旧连续滑窗整块重做**（`sliceRate`/`WINDOW_MS`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindowAt`/`computeFallbackTps`/`sampleTokens` 全删）：`BUCKET_MS=125`/`READ_BUCKETS=8`，**只读已完成桶**（不足 8 桶除以已过桶数）；`MIN_BUCKETS_FOR_READ=2` 起步返回保持值；`settle()` 尾部两桶 50/50 均衡（均值守恒）；结束后 `heldValue` 冻结 5 分钟（引擎真值 `realTokens/decodeSpan` 优先，否则 ≤1500ms 桶平均 `HOLD_BUCKETS=12`）；双钟 `TpsClock='generation'|'arrival'` 默认 generation（⚠️ `serverTs` epoch 与 `performance.now()` 绝不可混算，无戳帧永久降级并重建网格）；空桶计 0、静默 >1.5s 清窗重计；`RING_SIZE=64` 环宽于读数窗以摊平积压（`MAX_BUCKET_TPS=5000`）；指示器 30/70 指数平滑移除（桶平均本身即平滑）。
- **验证**：`tpsMeter.test.ts` 重写 27 例；tpsMeter/tpsCalibration/TpsIndicator 46/46；相关 8 文件 495 测试全绿；时钟纪律 A/B 永久用例（40 帧 5× 排空压缩：生成钟 104 真值 vs 到达钟 >300）；构建后 7788 入口 hash = 仓库 dist。⚠️ 真机观感验证当时未做，后由用户实测确认。

### 原链位 64 — `tps-background-freeze`

- **问题/需求**（用户 verbatim）：浏览器缩小切出去一段时间再切回，TPS 要么飙高、要么一直卡着不动。根因：后台节流使帧不处理而引擎照常产出，切回时整段积压**同一瞬间**落进同一个到达 125ms 桶；长静默清空环后 `depileBucket` 找不到可归属区间（`previous === -1`）不摊平 ⇒ 整段积压按一个 125ms 计费（60s 冻结 ⇒ 6240 token/桶 ≈ 50k t/s）。
- **方案**（全客户端）：① 无可归属区间的积压桶**丢弃而非摊平**（两种不可测情形）；② 丢弃粘性（`Bucket.dropped`）防后续 token 重建；③ 丢弃桶**不进分母**（空桶仍计 0，暂停如实读成凹陷）；④ 跨静默前把最后读数记入 `heldValue`，`settle()` 不用 0 覆盖真读数；⑤ 指示器防闪保持改**有界** `HOLD_UNCHANGED_MAX_MS=1500`（原无界保持把任何持续慢速冻结在旧值上）。
- **验证**：离线实测（真值 104、冻结 60s）到达钟序列「0 → 25,012 → 逐拍衰减 → 104」坐实「先 0 后被防闪规则无限期冻结、紧接着巨桶进窗」两端同源；修复后生成钟全程 104；新用例还原源码后分别以 6331/0 失败（证明修前会失败）；tpsMeter 27→31、TpsIndicator 11→12，相关 6 套件 669/669；`src/` 零改动；链复现度 64/64 apply 0 失败。

### 原链位 65 — `—`

**需求背景**：TPS 此前全靠字符估算；用户要求「不依赖后端引擎自适应：能发 token ids 走 ids」。引擎 Anthropic 协议（`/v1/messages`）原本不吐 token ids（vLLM 仅在 OpenAI 协议有 `return_token_ids` 且默认 off）。
- **方案**：引擎侧 `modify/patches/opt21-anthropic-token-ids-v1.patch` —— `/v1/messages` 每个 `content_block_delta` **顶层**带 `token_ids`（照 vLLM OpenAI 范式；⭐ 位置在 delta 顶层**非 delta 内**），后改为**触发式**（认头 `x-return-token-ids` ∨ body `return_token_ids`）。cc-haha 侧：私网 anthropic provider 自动经代理（排除 loopback）+ `src/server/proxy/streaming/anthropicTokenTap.ts` 流 tap（字节不变、旁路计数、带 kind）+ `count_tokens` 透传；`tpsTokenSink.ts` 注册式 sink 断 `ws→titleService→proxy` 成环，以 WS `tps_tokens` 帧下发。
- **验证**：直连 8000 与经 bc(8878) 两条链路 WS 均收到真实 `tps_tokens` 帧；活体实测 `tps_tokens` 0→22；`anthropicTokenTap.test.ts` 覆盖。

### 原链位 67 — `—`

**需求背景**：用户要求「改为每秒约 4 次变化」。
- **方案**：根因不是轮询频率（本就 4–8Hz）而是**1 秒均值把起伏抹平** ⇒ `READ_BUCKETS` 8→2 + 单一 `POLL_MS=250`；删掉我引入的重复常量 `LIVE_MS`（旧窗口长度），静默→held 统一用 `LIVE_GAP_MS=1500`。
- **验证**：抖动喂法实测 4.0 次/秒；`tpsMeter.test.ts`。
