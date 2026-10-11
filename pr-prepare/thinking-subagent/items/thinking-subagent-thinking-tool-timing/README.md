# thinking-subagent-thinking-tool-timing — 思考计时与工具耗时（原链位 21,28,29,39,41,43,49,61）

> 功能主题：`thinking-subagent` — 思考计时与子代理用量（`pr-prepare/thinking-subagent/`）｜ PR 分支 `thinking-subagent`
> **单一真相源 patch**：`modify/patches/thinking-subagent/thinking-subagent-thinking-tool-timing-patch1.patch`（54 文件 +3346−139）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 21 | `thinking-tool-timing` | 二十一 思考计时与工具计时综合优化（思考 badge+收纳栏总计时+token） |
| 28 | `thinking-badge-order-and-duration` | 二十一 子优化①：收纳栏「token 在前、耗时在后」+ `+` 间隔收紧 + 零耗时按未测处理 |
| 29 | `turn-usage` | 二十一 子优化②：轮次用量（每轮总消耗 token，口径=真实 `output_tokens`，`usageKey` 去重） |
| 39 | `subagent-background-task-durations` | 二十一 子优化④：**子代理耗时 + 子代理收纳栏总耗时 + 后台任务耗时**（汇总栏取**区间并集跨度**而非求和——子代理是并发派发；`agentRunInterval`/`agentGroupSpanMs` 另立，因全 Agent 组不进 `ActivityGroup`；新建 `ToolCallGroup.test`） |
| 41 | `background-task-duration-restore` | 二十一 子优化④ 补记二：后台任务耗时**恢复三层根因**（①`historyComplete=false` 时窗口被整空 → 跨度类重建改用已加载窗口；②通知型任务无起点 → 用其 `toolUseId` 的工具调用时刻回填；③**merge 把 restored `startedAt` 取成 `now`** → 保留调用方起点）+ 显示改紧凑 ASCII（`4m1s`）+ 消息列表内联卡耗时纳入「会话扩展信息」开关（6 文件 464 行） |
| 43 | `think-token-truth-chain` | 二十一 子优化⑤：**思考 token 走引擎真值**——代理透传 `reasoning_tokens` → usage 保活强转 → `ProgressTracker` 逐轮「真值否则估算」→ `AgentTaskNotification` 带 `output_tokens`/`think_tokens` → 桌面拆分渲染；契约=**发射方决定形态**（21 文件 669 增） |
| 49 | `subagent-usage-split-live` | 二十一 子优化⑥：**还原会话的 think/非think 拆分 + 组栏运行中实时跟进**——服务端 `sessionUsageRollup` 按 `toolUseId` 从子代理转录推导 usage 随通知下发（完成态权威）；组栏改读**运行中记录**（`agentTaskLiveUsage`）并以完成通知**二次校正**；实时节奏对齐思考徽章 3s（13 文件 781 增） |
| 61 | `subagent-live-metrics` | 二十一 子优化⑤：**子代理运行中用量/耗时真正爬升 + 移动端紧凑 + TPS 汇聚子代理读数修复**——（a）`subagentLiveChars` 累积器 + 3s 节流把在飞子代理的用量写进 `backgroundAgentTasks`，收纳栏数字**运行中就爬升**而非末尾跳变；（b）`useCompactMetrics()`（新增）驱动紧凑形态，本次进一步收紧 `gap-px tracking-tighter`，并修掉内层 `data-agent-group-usage` **硬编码 `gap-[3px]` 不随 compact 收敛**的问题；（c）**TPS 主修复**：`tpsMeter` 的 `Sample` 加 `stream` 标记、`ingestSubagentTps` 传 `runAgentId`，使可行性过滤按**同一流**的间隔判定——多流交织下原「全局间隔」判定误杀约 70% 样本，4 子代理并发时 UI 只有引擎真值的 **1/3**（实测 80 vs 250；修后逐秒对齐 346/331、387/387、381/382）。**⚠️ 本条保留链尾（链位 61），未与链位 21 融合**（详见二十一章子优化⑤）（5 文件） |

## 明细

### 原链位 21 — `thinking-tool-timing`

- 需求背景：用户要求「记录每次思考耗时并在对话记录里体现」，并递进为「think 横条右侧显示 token 用量（xx.xk）+ 耗时（三档阶梯）」；think 与工具不同，须从一开始持续计时，每 3 秒刷新一次，结束后固定。同时要求把「思考+工具收纳栏」的计时改为总计时、收纳栏 token 统计里「工具」部分按结果内容估算。
- 方案：
  - SDK 侧 `claude.ts` 在 `content_block_start(thinking)` 按 block index 记 `thinkingStartedAtByIndex`，块落 transcript 时算 `thinkingDurationMs` 写入 assistant meta（持久化，重开可回显）；
  - WS 侧 `streamBlocks.ts`/`handler.ts` 记 `thinkingBlockStarts`，`thinking_delta` 携带 `serverStart`（每 delta 幂等）；`events.ts`/`types/chat.ts` 加 `serverStart?`；
  - 客户端 `chatStore.settleThinkingDurations()` 在 `activeThinkingId` 清空点（text/tool_use block_start、message_complete、api_retry）把 `now - timestamp` 盖到 `thinkingDurationMs`；历史映射从 transcript 取值；
  - `ThinkingBlock.tsx` 纯函数 `thinkingBadgeLabel`/`formatThinkingTokens`/`formatThinkingDuration` + 3s `setInterval`（锚定 `serverStart`）；无耗时记录的旧会话单显 token；
  - `ActivityGroup.tsx`+`activityGroupModel.ts`：`activityDurationMs` 改分段求和，新增 `activityTokenUsage()`/`activityTokenLabel()`。
- 验证：tsc 0 错；前端相关家族 444/444 绿（ThinkingBlock 22 + ActivityGroup 16 + chatBlocks 44 + chatStore 354 + tpsMeter 8），server 3 测试家族 65/65。

### 原链位 28 — `thinking-badge-order-and-duration`

- 需求背景：用户指出收纳栏应「先显示 token 用量、再显示耗时」，`+` 号两段用量间隔不宜过大过小；think 内容现有 token 却无耗时需处理，老历史记录无耗时可跳过。
- 方案：
  - 顺序由「耗时在前、token 在后」改为「token 在前、耗时在后」；
  - `+` 间隔：monospace 字体里一个空格是固定宽度无法压小，改为结构化渲染——新增 `activityTokenParts(usage): string[]`，渲染层用 `flex gap-[3px]` 控制；`activityTokenLabel()` 保留为 `parts.join(' + ')` 不改既有签名；
  - 零耗时按「未测」处理：服务端缺锚点时不写该字段（`return {}`），客户端 `thinkingDurationMs === undefined || <= 0` 一律只显示 token（兼容已落盘的旧 0 值）。
- 验证：`ThinkingBlock` 23/23、`ActivityGroup` 16/16、前端 chat 家族 1246/1246（47 文件）、服务端 api 244/244、desktop `tsc --noEmit` 与 eslint 均 EXIT=0。实测坐实「旧进程比功能早 4 小时，重启后新思考块才带耗时」。

### 原链位 29 — `turn-usage`

- 需求背景：用户要求在每轮正文下附带信息（`复制 分享 · 日期时间 · 耗时`）中增加「每轮总消耗 token 量」，且「think 不回传则不纳入 think 用量」，并避免挤兑式大量计算浪费性能。
- 方案：
  - 口径裁决取**真实 `output_tokens`**（API 回传、`usageKey` 去重）——thinking 已含在 output 内，provider 不回传 thinking 时自然不计，恰好落实「不回传则不纳入」；
  - 性能：用量是已落 transcript 的真实数字（服务端 `sessionService` 归一化后连 `usageKey` 下发），读取即用零估算；累加挂进 `turnCompletion.ts` 既有 for 循环（`usageKey` 去重），不新增遍历；
  - 一轮=多次 API 调用，故求和；`0` 视为「未自报」不显示；行被并入上一行时 `stampResponseUsage` 双向扫描且「拒绝覆盖已带 usage 的行」；
  - 展示 `TurnCompletionStamp.tsx` 位于耗时之前；`types/chat.ts` 三个 UIMessage 变体加 `usage`/`usageKey`；i18n 5 语言加 `chat.turnUsage`。
- 验证：`turnCompletion` 19/19（含 6 条用量用例）、`TurnCompletionStamp` 8/8、locale 7/7、`chatStore` 360/360；`components/chat`+`lib`+`i18n` 家族 1763/1763；`tsc --noEmit` 与 eslint 均 exit 0。

### 原链位 39 — `subagent-background-task-durations`

- 需求背景：用户要求「给所有子代理加执行耗时，子代理收纳栏加总耗时统计，所有后台执行任务加耗时信息，并入 think 耗时优化项」。展示规格：汇总行带中文标签「派遣了 N 个子代理 · 总耗时 x · 状态」（靠右），每条子代理行插裸数字，activity 面板行/详情卡右侧加耗时。
- 方案：
  - **汇总栏 = 区间并集跨度（wall-clock span），不是各子代理耗时之和**——子代理是并发派发，串行才可求和；每个 run 先求区间 `{startMs,endMs}`（`agentRunInterval`：start=父会话 Agent `tool_use` timestamp，end=有上报取 `start+usage.durationMs`，否则 `tool_result.timestamp`），汇总 `agentGroupSpanMs = max(end) - min(start)`；
  - 单行数字取该 run 自身长度 `end - start`（`agentRunDurationMs`）；全 Agent 组走 `AgentToolGroup` 短路进不了 `ActivityGroup`，故另立 `agentRunInterval`/`agentGroupSpanMs`；
  - 数字格式用工具徽章同款 `formatDuration`（紧凑 `5m12s`）；activity 面板保留自身既有 `formatBackgroundDuration`；
  - 上报值优先、时间戳回退；`0` 不算测量值；未 settled 的同步 run 不显示数字。
- 验证：`ActivityGroup.test` 6 条（含并发三 run 取跨度 121s 且断言 ≠ 求和 361.5s）；新建 `ToolCallGroup.test` 4 条端到端（两代理错开 199s 发起→汇总跨度 `8m19s` ≠ 串行和 `7m0s`，同时发起两 run 汇总=`2m0s` 非 `4m0s`）；桌面 `tsc --noEmit` 0 错。

### 原链位 41 — `background-task-duration-restore`

- 需求背景：用户反馈「重开老会话后后台任务不显示耗时」（新会话当场能看到）。排查为三层互相独立的根因叠加，修掉任一层都看不到效果。
- 方案：
  - 根因一：`historyComplete=false` 时窗口被整空 → 跨度类重建改用已加载窗口（`goal`/`todos` 仍受完整性闸门）；实测 28.8MB 会话 1.5s 撞 `HISTORY_STITCH_MAX_PAGES=40` 上限致 `historyComplete` 恒 false，改后 44 条后台任务、33 条有真实跨度（置空则 0 条）；
  - 根因二：通知型任务无起点 → 新增 `backfillTaskStartsFromToolCalls` 用 `toolUseId` 找到工具调用时刻回填 `startedAt`（补齐后 44/44 全有跨度）；
  - 根因三（最深）：`mergeBackgroundAgentTaskRecords` 把恢复出来的 `startedAt` 抹成 `now` → 改为 `startsNewLifecycle ? now : existing?.startedAt ?? event.startedAt ?? now`（修后全链路 44/44）；
  - 显示改紧凑 ASCII（`43s`/`4m1s`/`1h2m`，超 1h 不显秒），范围仅活动面板后台任务；补齐「会话扩展信息」开关漏管的后台任务内联卡耗时。
- 验证（链位 41）：`tsc --noEmit` 0 错；`chatStore.test` 369（+3）、`SessionActivityPanel.test` 26、`MessageList.test` 202（+1）；桌面全量 6315 通过 / 0 失败。

### 原链位 43 — `think-token-truth-chain`

- 需求背景：思考 token 此前只能估算，用户希望「think 真值」——让思考用量取引擎回传的真实 `reasoning_tokens`，并让 `AgentTaskNotification` 携带 `output_tokens`/`think_tokens` 供桌面拆分渲染。
- 方案：
  - 代理透传 `reasoning_tokens`（兼容 vLLM `completion_tokens_details` 与 Responses `output_tokens_details`）；
  - usage 保活强转；`ProgressTracker` 逐轮「真值否则估算」；
  - `AgentTaskNotification` 带 `output_tokens`/`think_tokens` → 桌面拆分渲染；
  - 契约=**发射方决定形态**（think 回传时界面回单一总量，不回传时拆 think/非think 两段）。
- 验证：21 文件 669 增；思考 token 由估算升级为引擎真值，与链位 49/52 的拆分口径衔接。

### 原链位 49 — `subagent-usage-split-live`

- 需求背景：用户要求「think 不回传就应显示成 think 用量 + 非think 用量」（而非只有 think 回传时才有的一条总用量），并「对派发子代理总收纳栏的用量和耗时做实时跟进（每 5s 刷新），完成后二次校验修正」。
- 方案：
  - 三段根因：①历史转录本无拆分（`<usage>` 块只在 `reasoningTokens != null` 时写，pilot 58/58 只有旧口径 total）；②数据其实在子代理转录（76 个 general-purpose Σ`output_tokens`=727,879、Σthink=457,285）；③还原路径拿不到 usage（`SessionTaskNotification` 无 `usage` 字段）、组栏读错地方（读「已完成通知」而非「运行中记录」）；
  - 服务端新增 `sessionUsageRollup.ts`：按 `toolUseId` 关联子代理转录，逐轮累加 output、思考取「引擎真值否则估算」，与 `finalizeAgentTool` 同口径，结果作为 `usage` 随 `taskNotifications` 下发；缓存按 `getSessionMessagesSignature` 失效；
  - 客户端：组栏新增 `agentTaskLiveUsage`（`MessageList` 由 `backgroundAgentTasks` 派生、只取 `status==='running'`），「运行中记录优先、否则回落完成通知」；耗时用墙钟跨度（在飞成员以 now 闭合），数字标 ≈；完成通知即二次校正；实时节奏复用思考徽章 `LIVE_ELAPSED_REFRESH_MS`（3s）。
- 验证：数字对账（pilot `f1be2b52`）API 返回 60 条带 usage，Σtotal=727,879、Σthink=457,330 与独立手工核算一致，单次请求 ≈0.18s；`bun run check:server` 493 文件 5947 通过 0 失败，前端全量 6341 通过 0 失败，`tsc -b` 0 错。

### 原链位 61 — `subagent-live-metrics`

- 需求背景：用户要求「子代理收纳栏内用量和耗时攀升」「移动端显示更紧凑、字符间距紧凑」「主会话 TPS 汇聚子代理不准确」。（⚠️ 本 patch 有意保留链位 61 独立、未与链位 21 融合——链位 22→60 有 10+ 补丁同改 `ToolCallGroup.tsx`/`MessageList.tsx`/`chatStore.ts`，回折会逐个重放失败。）
- 方案：
  - ⑤-1 TPS 汇聚读数只有真值 1/3：`tpsMeter.sliceRate()` 可行性过滤只按全局间隔，多流交织后相邻样本常来自不同流（帧间隔中位 0.246ms、66.5%<1ms），正常分片被判「批量投递」丢弃约 70-73%；修法是 `Sample` 加 `stream?`、`push(text,{stream})` 记录来源流，可行性判定改用「同一流上一样本」的间隔（首样本回退 `origin` 保守保留），接线 `ingestSubagentTps(...,msg.runAgentId)`；
  - ⑤-2 移动端紧凑：收纳栏汇总行 compact 态 `gap-[2px] text-[11px] tracking-tight` → `gap-px tracking-tighter`；内层 `data-agent-group-usage` 的 `gap-[3px]` 改随 compact 收紧；轮次页脚 `gap-1.5 tracking-tight` → `gap-1 tracking-tighter`；
  - ⑤-3 用量爬升真根因：`task_progress` 只在工具轮次边界发且只计已完成轮次；客户端其实一直持有 `agent_run_event` 实时增量，新增 `ingestSubagentLiveUsage`（挂 `agent_run_event` 分支，按 `runAgentId` 累加、每 3s 写一次），`totalTokens` 必须含思考 `(text+thinking)/4`；耗时爬升：在飞成员不把「启动回执」当结束（`inFlight ? undefined : resultMap.get(...)`）。
- 验证：离线重放取证——现状全局间隔过滤 20s 后均值 74.7，无过滤 252.7，**按流间隔过滤 244.5**（✅）；端到端复修后 UI 与引擎逐秒对齐（63s 346/331、73s 387/387、85s 381/382）；`tpsMeter.test` 29 通过（+2，新用例旧逻辑必红读到 49.3 期望 >120）；`tsc --noEmit` 0 错。
