# tps — TPS 实时解码速度指示器

> PR 分支：`tps-indicator`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/tps/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `tps-indicator` | `tps-indicator-patch1.patch` | 7,30,35,38,42,44,50,54 | +2743−14 | 25 |
| `tps-engine-rewrite` | `tps-engine-rewrite-patch1.patch` | 62,64,65,67 | +2269−1002 | 25 |
| `tps-density-estimation` | `tps-density-estimation-patch1.patch` | 66 | +728−43 | 10 |
| `tps-session-total` | `tps-session-total-patch1.patch` | 新增 | +118−70 | 5 |

## 功能域概述

会话流式输出时在桌面头栏 / 移动端顶栏显示实时解码速度（token/秒），帮助用户感知模型吞吐。本 PR 覆盖该功能从 0.6.6 基座（无任何 TPS 代码）到最终形态的完整迭代史：字符估算米表 → 子代理汇聚 → 真实 token 口径（三层源自适应 + 对账校准）→ 按内容度量 → 多轮脉冲/爆读根因修复 → 最终按用户 5 条规格整块重写为 125ms 固定网格分桶引擎，以及后台标签页冻结场景的收尾修复。

## 演进主线

**第一阶段（链位 7/30）：把指示器做出来并站稳。** 0.6.6 无 TPS 代码，从老 fork 移植 `tpsMeter`（1.5s 滑动窗口，字符估算 CJK≈1 token/字、ASCII≈1/3.5 字）+ `TpsIndicator`（180ms 轮询、四档着色、5 分钟空闲隐藏），接入 chatStore 的 `appendPendingDelta`/`appendPendingToolInputDelta` 两个喂入点，并补齐移动端两行竖排、子代理汇聚（`agent_run_event` 直接喂父米表，修掉「不打开子代理页就完全不计入」的 tab 归属设计错误）、thinking 计入、保持值口径（正文结束前 0.5s 平均）等子优化。链位 30 按用户反馈把「费用上/TPS 下」两行中的 TPS 行由右对齐改居中。

**第二阶段（链位 35/38）：从估算走向真实口径。** 用户核实「TPS 一直是字符估算」后要求自适应真实 token：链位 35 实现三层源（`ids` 精确 / `chunk` 帧计数 / `char` 字符兜底）+ 每次 `message_complete` 用真实 `output_tokens` 坐标下降对账校准 + 引擎 `return_token_ids` 旁路（WS `tps_tokens` 帧、注册式 sink 断环）。实测发现「每帧 token 数」全局系数方案在 6 并发子代理下被工具入参密帧污染（kChunk clamp 到 8），读数 800 vs 引擎真值 290（2.8×）；链位 38 用「按内容度量」整体替换帧计数（`kCjk`/`kAscii` 两系数最小二乘学习，`ids` 独占），修后同场景 363 vs 290（1.25×，残余即语料真实 CJK 密度与中性值之差）。

**第三阶段（链位 42/44/50/54）：连修四轮「读数爆炸」根因。** 每轮都是生产实测爆读 → 离线复现 → 修单点，且**每轮都是独立的真因**：① 流切换处窗口塌缩、积压 token 被 400ms 地板除（生产 1000-2000 t/s，真值 230-280）→ 加「刚滑出窗口的样本」锚 `preWindowAt`；② 思考徽章取不到精确单块 token → `tps_tokens` 带 kind + 代理透传 `reasoning_tokens`；③ 相位切换 9999 脉冲 → `total` 与 `span` 不是同一批 token 的时间（锚条件太窄/无前置样本凭空造 400ms 分母）→ 收敛成 `sliceRate()` 单条规则「一批 token 在其与前一批之间生成」，只算稳态段；④ 上千读数（尤其 bash 时）→ 打包投递（重放/整块交付/页面忙时排队帧）被当成生成节奏 → 逐样本只计入「到达间隔能支撑其实时速率」的样本（上限 5000）。

**第四阶段（链位 62/64）：推倒重来 + 收尾。** 用户给出 5 条明确规格（125ms 分桶 / 起步延迟 / 尾部 50-50 均衡 / 结束后保持 / ids 优先），旧连续滑窗的所有机制（`sliceRate`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindowAt` 等）全部删除，换成固定网格分桶引擎；链位 64 修后台标签页节流切回后「飙高+卡住」同源问题（积压同瞬间落进同一个 125ms 桶）。

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（4 项）：
- `items/tps-indicator/README.md`
- `items/tps-engine-rewrite/README.md`
- `items/tps-density-estimation/README.md`
- `items/tps-session-total/README.md`
