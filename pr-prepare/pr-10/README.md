# pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）

## 功能域概述

本组把「思考耗时 / token」与「子代理用量 / 耗时」两类读数做全链路打通：既让主会话的思考横条从服务端收到 think 块起实时计时并展示 token 用量，也让子代理（并发派发）的耗时取区间并集跨度、用量按 think/非think 拆分并按 `toolUseId` 跨客户端对齐。整组横跨 SDK→WS→服务端推导→客户端渲染四层，10 个 patch 共同依赖 `chatStore.ts` / `MessageList.tsx` / `ToolCallGroup.tsx` / `activityGroupModel.ts` 等共享文件，是功能交织最密集的一组。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. 思考计时与工具计时综合优化（链位 21，`21-thinking-tool-timing.patch`）

- 需求背景：用户要求「记录每次思考耗时并在对话记录里体现」，并递进为「think 横条右侧显示 token 用量（xx.xk）+ 耗时（三档阶梯）」；think 与工具不同，须从一开始持续计时，每 3 秒刷新一次，结束后固定。同时要求把「思考+工具收纳栏」的计时改为总计时、收纳栏 token 统计里「工具」部分按结果内容估算。
- 方案：
  - SDK 侧 `claude.ts` 在 `content_block_start(thinking)` 按 block index 记 `thinkingStartedAtByIndex`，块落 transcript 时算 `thinkingDurationMs` 写入 assistant meta（持久化，重开可回显）；
  - WS 侧 `streamBlocks.ts`/`handler.ts` 记 `thinkingBlockStarts`，`thinking_delta` 携带 `serverStart`（每 delta 幂等）；`events.ts`/`types/chat.ts` 加 `serverStart?`；
  - 客户端 `chatStore.settleThinkingDurations()` 在 `activeThinkingId` 清空点（text/tool_use block_start、message_complete、api_retry）把 `now - timestamp` 盖到 `thinkingDurationMs`；历史映射从 transcript 取值；
  - `ThinkingBlock.tsx` 纯函数 `thinkingBadgeLabel`/`formatThinkingTokens`/`formatThinkingDuration` + 3s `setInterval`（锚定 `serverStart`）；无耗时记录的旧会话单显 token；
  - `ActivityGroup.tsx`+`activityGroupModel.ts`：`activityDurationMs` 改分段求和，新增 `activityTokenUsage()`/`activityTokenLabel()`。
- 验证：tsc 0 错；前端相关家族 444/444 绿（ThinkingBlock 22 + ActivityGroup 16 + chatBlocks 44 + chatStore 354 + tpsMeter 8），server 3 测试家族 65/65。

### 2. 收纳栏顺序 + `+` 间隔 + 零耗时按未测处理（链位 28，`28-thinking-badge-order-and-duration.patch`）

- 需求背景：用户指出收纳栏应「先显示 token 用量、再显示耗时」，`+` 号两段用量间隔不宜过大过小；think 内容现有 token 却无耗时需处理，老历史记录无耗时可跳过。
- 方案：
  - 顺序由「耗时在前、token 在后」改为「token 在前、耗时在后」；
  - `+` 间隔：monospace 字体里一个空格是固定宽度无法压小，改为结构化渲染——新增 `activityTokenParts(usage): string[]`，渲染层用 `flex gap-[3px]` 控制；`activityTokenLabel()` 保留为 `parts.join(' + ')` 不改既有签名；
  - 零耗时按「未测」处理：服务端缺锚点时不写该字段（`return {}`），客户端 `thinkingDurationMs === undefined || <= 0` 一律只显示 token（兼容已落盘的旧 0 值）。
- 验证：`ThinkingBlock` 23/23、`ActivityGroup` 16/16、前端 chat 家族 1246/1246（47 文件）、服务端 api 244/244、desktop `tsc --noEmit` 与 eslint 均 EXIT=0。实测坐实「旧进程比功能早 4 小时，重启后新思考块才带耗时」。

### 3. 轮次用量（每轮总消耗 token）（链位 29，`29-turn-usage.patch`）

- 需求背景：用户要求在每轮正文下附带信息（`复制 分享 · 日期时间 · 耗时`）中增加「每轮总消耗 token 量」，且「think 不回传则不纳入 think 用量」，并避免挤兑式大量计算浪费性能。
- 方案：
  - 口径裁决取**真实 `output_tokens`**（API 回传、`usageKey` 去重）——thinking 已含在 output 内，provider 不回传 thinking 时自然不计，恰好落实「不回传则不纳入」；
  - 性能：用量是已落 transcript 的真实数字（服务端 `sessionService` 归一化后连 `usageKey` 下发），读取即用零估算；累加挂进 `turnCompletion.ts` 既有 for 循环（`usageKey` 去重），不新增遍历；
  - 一轮=多次 API 调用，故求和；`0` 视为「未自报」不显示；行被并入上一行时 `stampResponseUsage` 双向扫描且「拒绝覆盖已带 usage 的行」；
  - 展示 `TurnCompletionStamp.tsx` 位于耗时之前；`types/chat.ts` 三个 UIMessage 变体加 `usage`/`usageKey`；i18n 5 语言加 `chat.turnUsage`。
- 验证：`turnCompletion` 19/19（含 6 条用量用例）、`TurnCompletionStamp` 8/8、locale 7/7、`chatStore` 360/360；`components/chat`+`lib`+`i18n` 家族 1763/1763；`tsc --noEmit` 与 eslint 均 exit 0。

### 4. 子代理耗时 + 子代理收纳栏总耗时 + 后台任务耗时（链位 39，`39-subagent-background-task-durations.patch`）

- 需求背景：用户要求「给所有子代理加执行耗时，子代理收纳栏加总耗时统计，所有后台执行任务加耗时信息，并入 think 耗时优化项」。展示规格：汇总行带中文标签「派遣了 N 个子代理 · 总耗时 x · 状态」（靠右），每条子代理行插裸数字，activity 面板行/详情卡右侧加耗时。
- 方案：
  - **汇总栏 = 区间并集跨度（wall-clock span），不是各子代理耗时之和**——子代理是并发派发，串行才可求和；每个 run 先求区间 `{startMs,endMs}`（`agentRunInterval`：start=父会话 Agent `tool_use` timestamp，end=有上报取 `start+usage.durationMs`，否则 `tool_result.timestamp`），汇总 `agentGroupSpanMs = max(end) - min(start)`；
  - 单行数字取该 run 自身长度 `end - start`（`agentRunDurationMs`）；全 Agent 组走 `AgentToolGroup` 短路进不了 `ActivityGroup`，故另立 `agentRunInterval`/`agentGroupSpanMs`；
  - 数字格式用工具徽章同款 `formatDuration`（紧凑 `5m12s`）；activity 面板保留自身既有 `formatBackgroundDuration`；
  - 上报值优先、时间戳回退；`0` 不算测量值；未 settled 的同步 run 不显示数字。
- 验证：`ActivityGroup.test` 6 条（含并发三 run 取跨度 121s 且断言 ≠ 求和 361.5s）；新建 `ToolCallGroup.test` 4 条端到端（两代理错开 199s 发起→汇总跨度 `8m19s` ≠ 串行和 `7m0s`，同时发起两 run 汇总=`2m0s` 非 `4m0s`）；桌面 `tsc --noEmit` 0 错。

### 5. 后台任务耗时恢复三层根因（链位 41，`41-background-task-duration-restore.patch`）

- 需求背景：用户反馈「重开老会话后后台任务不显示耗时」（新会话当场能看到）。排查为三层互相独立的根因叠加，修掉任一层都看不到效果。
- 方案：
  - 根因一：`historyComplete=false` 时窗口被整空 → 跨度类重建改用已加载窗口（`goal`/`todos` 仍受完整性闸门）；实测 28.8MB 会话 1.5s 撞 `HISTORY_STITCH_MAX_PAGES=40` 上限致 `historyComplete` 恒 false，改后 44 条后台任务、33 条有真实跨度（置空则 0 条）；
  - 根因二：通知型任务无起点 → 新增 `backfillTaskStartsFromToolCalls` 用 `toolUseId` 找到工具调用时刻回填 `startedAt`（补齐后 44/44 全有跨度）；
  - 根因三（最深）：`mergeBackgroundAgentTaskRecords` 把恢复出来的 `startedAt` 抹成 `now` → 改为 `startsNewLifecycle ? now : existing?.startedAt ?? event.startedAt ?? now`（修后全链路 44/44）；
  - 显示改紧凑 ASCII（`43s`/`4m1s`/`1h2m`，超 1h 不显秒），范围仅活动面板后台任务；补齐「会话扩展信息」开关漏管的后台任务内联卡耗时。
- 验证（链位 41）：`tsc --noEmit` 0 错；`chatStore.test` 369（+3）、`SessionActivityPanel.test` 26、`MessageList.test` 202（+1）；桌面全量 6315 通过 / 0 失败。

### 6. 思考 token 走引擎真值（链位 43，`43-think-token-truth-chain.patch`）

- 需求背景：思考 token 此前只能估算，用户希望「think 真值」——让思考用量取引擎回传的真实 `reasoning_tokens`，并让 `AgentTaskNotification` 携带 `output_tokens`/`think_tokens` 供桌面拆分渲染。
- 方案：
  - 代理透传 `reasoning_tokens`（兼容 vLLM `completion_tokens_details` 与 Responses `output_tokens_details`）；
  - usage 保活强转；`ProgressTracker` 逐轮「真值否则估算」；
  - `AgentTaskNotification` 带 `output_tokens`/`think_tokens` → 桌面拆分渲染；
  - 契约=**发射方决定形态**（think 回传时界面回单一总量，不回传时拆 think/非think 两段）。
- 验证：21 文件 669 增；思考 token 由估算升级为引擎真值，与链位 49/52 的拆分口径衔接。

### 7. 还原会话的 think/非think 拆分 + 组栏运行中实时跟进（链位 49，`49-subagent-usage-split-live.patch`）

- 需求背景：用户要求「think 不回传就应显示成 think 用量 + 非think 用量」（而非只有 think 回传时才有的一条总用量），并「对派发子代理总收纳栏的用量和耗时做实时跟进（每 5s 刷新），完成后二次校验修正」。
- 方案：
  - 三段根因：①历史转录本无拆分（`<usage>` 块只在 `reasoningTokens != null` 时写，pilot 58/58 只有旧口径 total）；②数据其实在子代理转录（76 个 general-purpose Σ`output_tokens`=727,879、Σthink=457,285）；③还原路径拿不到 usage（`SessionTaskNotification` 无 `usage` 字段）、组栏读错地方（读「已完成通知」而非「运行中记录」）；
  - 服务端新增 `sessionUsageRollup.ts`：按 `toolUseId` 关联子代理转录，逐轮累加 output、思考取「引擎真值否则估算」，与 `finalizeAgentTool` 同口径，结果作为 `usage` 随 `taskNotifications` 下发；缓存按 `getSessionMessagesSignature` 失效；
  - 客户端：组栏新增 `agentTaskLiveUsage`（`MessageList` 由 `backgroundAgentTasks` 派生、只取 `status==='running'`），「运行中记录优先、否则回落完成通知」；耗时用墙钟跨度（在飞成员以 now 闭合），数字标 ≈；完成通知即二次校正；实时节奏复用思考徽章 `LIVE_ELAPSED_REFRESH_MS`（3s）。
- 验证：数字对账（pilot `f1be2b52`）API 返回 60 条带 usage，Σtotal=727,879、Σthink=457,330 与独立手工核算一致，单次请求 ≈0.18s；`bun run check:server` 493 文件 5947 通过 0 失败，前端全量 6341 通过 0 失败，`tsc -b` 0 错。

### 8. 拆分「真实用量 0」修复——估算与真值双计（链位 52，`52-split-no-double-count.patch`）

- 需求背景：改动后用户反馈「未思考的用量是 0，思考的用量是真实用量，要修正」。取证实录显示一轮响应被拆成两条 assistant 记录（思考一条、正文一条，**共享 `message.id`**），只有带 usage 的那条能报 reasoning。
- 方案：
  - 根因：31165 字符的思考被估算（≈8.9k），又叠上同响应真实 6777 ⇒ think 15.7k > total 9.3k ⇒ 界面 `Math.max(0, total - think)` 恒为 0；
  - 修法：按**响应 id 归组**，某响应报了真值就丢弃它先前那条拆分记录的估算；CLI 侧 `LocalAgentTask.tsx` tracker 新增 `thinkingEstimatesByResponse: Map<id, number>`（`reported>0` 时先减同 id 估算再计真值）；服务端 `sessionUsageRollup.computeSubagentUsage` 批量版「有真值的响应不采用估算」；无 `message.id` 的记录维持逐条行为；两处各加一条钉住该形状的测试。
- 验证（真实数据，dev 实例）：6 个子代理比对新代码 API 返回 vs 独立期望值 6/6 完全一致，非思考分量由 0 变为 3332/2523/3654/4286/4192/2721；该会话 66 条带 usage 通知中 `think > total` 0 条；Σtotal=798,076、Σthink=506,819 ⇒ 非思考 291,257。

### 9. 子代理运行中用量/耗时真正爬升 + 移动端紧凑 + TPS 汇聚读数修复（链位 61，`61-subagent-live-metrics.patch`）

- 需求背景：用户要求「子代理收纳栏内用量和耗时攀升」「移动端显示更紧凑、字符间距紧凑」「主会话 TPS 汇聚子代理不准确」。（⚠️ 本 patch 有意保留链位 61 独立、未与链位 21 融合——链位 22→60 有 10+ 补丁同改 `ToolCallGroup.tsx`/`MessageList.tsx`/`chatStore.ts`，回折会逐个重放失败。）
- 方案：
  - ⑤-1 TPS 汇聚读数只有真值 1/3：`tpsMeter.sliceRate()` 可行性过滤只按全局间隔，多流交织后相邻样本常来自不同流（帧间隔中位 0.246ms、66.5%<1ms），正常分片被判「批量投递」丢弃约 70-73%；修法是 `Sample` 加 `stream?`、`push(text,{stream})` 记录来源流，可行性判定改用「同一流上一样本」的间隔（首样本回退 `origin` 保守保留），接线 `ingestSubagentTps(...,msg.runAgentId)`；
  - ⑤-2 移动端紧凑：收纳栏汇总行 compact 态 `gap-[2px] text-[11px] tracking-tight` → `gap-px tracking-tighter`；内层 `data-agent-group-usage` 的 `gap-[3px]` 改随 compact 收紧；轮次页脚 `gap-1.5 tracking-tight` → `gap-1 tracking-tighter`；
  - ⑤-3 用量爬升真根因：`task_progress` 只在工具轮次边界发且只计已完成轮次；客户端其实一直持有 `agent_run_event` 实时增量，新增 `ingestSubagentLiveUsage`（挂 `agent_run_event` 分支，按 `runAgentId` 累加、每 3s 写一次），`totalTokens` 必须含思考 `(text+thinking)/4`；耗时爬升：在飞成员不把「启动回执」当结束（`inFlight ? undefined : resultMap.get(...)`）。
- 验证：离线重放取证——现状全局间隔过滤 20s 后均值 74.7，无过滤 252.7，**按流间隔过滤 244.5**（✅）；端到端复修后 UI 与引擎逐秒对齐（63s 346/331、73s 387/387、85s 381/382）；`tpsMeter.test` 29 通过（+2，新用例旧逻辑必红读到 49.3 期望 >120）；`tsc --noEmit` 0 错。

### 10. 子代理跨客户端用量一致性（链位 63，`63-subagent-usage-cross-client.patch`）

- 需求背景：用户反馈 A 客户端发起的会话能看到实时用量，B 客户端打开同一会话「有很长一段时间看不到用量爬升」；修身份后 B 能看到但从 0 开始、没跟 A 一致。两个根因都修完才对得上。
- 方案：
  - 根因一（真根因，身份对齐）：`runAgentId`（run 自己的 id，6 位 hex）与 `tool_use_id`（派发它的 Agent 工具调用 id，`call_00_…`）是两个 id，UI 按 `toolUseId` 读、实时写入方 `ingestSubagentLiveUsage` 建无既有行时却填 `toolUseId=agentId`（runAgentId）⇒ 后加入客户端 B 的行永远读不到（数字突然出现=某子代理跨工具轮次边界后 `task_progress` 带来真 id 才改写）。修法：服务端 `activeSubagentIds` → `activeSubagentRuns` 返回 `{taskId, toolUseId}[]`，`runningAgentUsage` 每项带两个 id，「没有总量也要发」（`totalTokens` 可选、`taskId`/`toolUseId` 必需），客户端种子行按 run id 作键并携带 tool-call id；
  - 根因二：后加入者基线只有分界粒度、从 0 起 → 新增服务端在飞外推器 `agentRunUsageProjection.ts`，计数点在 `conversationService.notifyOutputCallbacks` 之前（每会话每消息恰一次），规则刻意镜像客户端（`text_delta`/`input_json_delta`→text、`thinking_delta`→thinking、`/4` 估 token），并镜像「哪些不计」；种子取 `max(rollup, projection)`，完成时终态通知仍权威；
  - 顺带修：rebase 后就 `acc.lastWritten = reported`（采用基准即记账），避免「无变化就 return」把累加清零的死循环。
- 验证：身份对齐核心回归（种 `{taskId:'a74ce8',toolUseId:'call_00_x'}` + 喂 `runAgentId` 帧 ⇒ 写落同一行、爬过种子、只有一行）；服务端 `activeSubagentRuns` 5 例、路由 11 例、投影 10 例（含镜像回归）；`chatStore` 380/380；`check:server` 496 文件 5975 条 0 失败；链 63/63 apply 0 失败；真机用户确认 B 与 A 数值一致。

## 验证口径（组级）

- 类型检查：desktop 与服务端 `tsc --noEmit`（或 `tsc -b`）0 错；涉及 desktop 的改动须跑 `tsc -b`（vitest 不做类型检查，会放行 test 文件类型错误）。
- 服务端权威口径：`bun run check:server`（逐文件独立进程 + env 白名单，组末基线约 496 文件 / 5975 条 / 0 失败）；勿用 `bun test src/utils` 整目录（`mock.module` 泄漏 + ambient env 假红）。
- 前端：桌面全量 vitest（组内各章实测 6315~6341 通过 / 0 失败）+ 相关组件家族（`ToolCallGroup`/`ActivityGroup`/`ThinkingBlock`/`MessageList`/`chatStore`）。
- 真实数据对账：pilot 会话 `f1be2b52`（Σtotal=727,879/Σthink≈457k）与 6 文案子代理批次（非思考 3332/2523/3654/4286/4192/2721），均要求 API 返回与独立手工核算逐值一致。
- 链复现度：干净 worktree@`068b3ebd` 按链序 `git apply`（**必须 `--index`**）0 失败，终态与工作树逐字节一致（仅差 `bun.lock` 与 `preview-agent.js` 两个有意排除项）。
- 生效方式：服务端 TS 由 bun 直跑仅重启 sidecar 即生效；前端渲染（bundle）须重新 `vite build`（H5 走 `CLAUDE_H5_DIST_DIR` 服务 `desktop/dist`）。

## 与其他组的关系

- **依赖 pr-3（TPS 速率引擎）**：本组链位 61 修复的「TPS 汇聚子代理读数只有真值 1/3」落在 `tpsMeter.ts`，其可行性过滤的 `stream?` 标记、按流间隔判定直接构建在 pr-3 的速率引擎之上；`tpsCalibration.ts`/`tpsMeter.ts` 也作为本组传递依赖出现。
- **依赖 pr-5（usage 口径）**：本组链位 29（轮次用量取真实 `output_tokens`、`usageKey` 去重）、43/49/52（think/非think 拆分、`sessionUsageRollup`、响应 id 归组去双计）都建立在 pr-5 确立的 usage 归一化与去重口径上；`summarizeTokenUsageFromHistory`、`usageKey`、`MessageUsage` 类型跨组共用。
- 子代理数据链路（`agent_run_event`/`task_progress`/`task_started` → `backgroundAgentTasks` → `agentTaskLiveUsage`）本组内多个 patch 逐层叠加（49 建实时跟进、61 建爬升、63 建跨客户端对齐），须按链序理解，不可乱序合并。

## 风险与备注

- ⚠️ **上游冲突风险文件**（上游 main 也改过，合并需三方核对）：`desktop/src/components/chat/MessageList.tsx`、`MessageList.test.tsx`、`desktop/src/stores/chatStore.ts`、`chatStore.test.ts`、`desktop/src/types/chat.ts`、`desktop/src/i18n/locales/{en,jp,kr,zh,zh-TW}.ts`、`src/server/api/sessions.ts`、`src/server/services/conversationService.ts`、`sessionService.ts`、`src/server/ws/events.ts`、`handler.ts`、`src/services/api/claude.ts`、`src/tools/AgentTool/AgentTool.tsx`、`src/server/__tests__/session-messages-http.test.ts`。
- **10 个 patch 交织于共享文件**：`chatStore.ts`（settleThinkingDurations/stampResponseUsage/ingestSubagentLiveUsage 分属链位 21/29/61）、`ToolCallGroup.tsx`/`activityGroupModel.ts`（21/28/39/49/61/63）、`MessageList.tsx`（49/61/63）、`types/chat.ts`（21/29/43）、`claude.ts`（21/43/44 透传）、`turnCompletion.ts`/`TurnCompletionStamp.tsx`（29/61）。合并时须逐 patch 按链序 `git apply --index` 验证，避免 hunk 互相覆盖。
- **链位 61 有意独立**：未与链位 21 融合（10+ 下游补丁同改 `ToolCallGroup.tsx`/`MessageList.tsx`/`chatStore.ts`，回折会连锁重放失败）；PR 内保留为独立 patch。
- **口径易混点**：收纳栏总耗时——子代理组并发派发取**区间并集跨度**（`agentGroupSpanMs`），而「思考+工具」步骤串行取**分段求和**（`activityDurationMs`）；token 求和（`agentGroupTokens`）与耗时取跨度是同一行里两条不同聚合规则，各有理由。
- **`0` 的一贯原则**：0 不视为测量值（零耗时按未测、`agentRunInterval` 不认 0 上报值、`getReasoningTokenCountFromUsage` 用 `reported > 0 ? reported : 估算`）；避免把「没测」渲染成自信的数字。
- **`usage` 来源**：transcript 顶层无 `usage`，在嵌套 `message.usage` 里，客户端拿到的始终是服务端 `sessionService` 盖章归一化后的形态；轮次分组只认 `UIMessage` 不认 `MessageEntry`，故须先把用量送进 `UIMessage`。
- **依赖补齐文件**（本组 patch 未直接改、链内由其他组引入的传递依赖）：`h5Access.ts`、`DownloadReferencesCard.tsx`、`desktopRuntime.ts`、`downloadFileMeta.ts`、`fileSizeCache.ts`、`handlePreviewLink.ts`、`tpsCalibration.ts`、`tpsMeter.ts`、`settingsStore.ts`、`types/settings.ts`——PR 合并时须确认这些上游/他组改动已就位。
- **golden 夹具**：`__fixtures__/chat-store.golden.json` 因链位 21 引入 `thinkingDurationMs` 须重录（`UPDATE_CHAT_STORE_GOLDEN=1`，值 51ms 为确定值，须验幂等），否则链终态 golden 会红。
