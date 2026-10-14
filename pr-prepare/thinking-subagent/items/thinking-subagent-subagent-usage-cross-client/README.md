# thinking-subagent-subagent-usage-cross-client — 子代理用量跨客户端一致（原链位 63）

> 功能主题：`thinking-subagent` — 思考计时与子代理用量（`pr-prepare/thinking-subagent/`）｜ PR 分支 `thinking-subagent`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/thinking-subagent/thinking-subagent-subagent-usage-cross-client-patch1.patch`（11 文件 +1067−39）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 63 | `subagent-usage-cross-client` | 二十八 28.2：**子代理跨客户端用量一致性**——① **身份对齐**（真根因）：`runAgentId` 与「派发它的 Agent 工具调用 id」被混用（UI 按 `toolUseId` 读、实时写入方却填成 runAgentId）⇒ 后加入的客户端把数字写进一张**永远读不到**的行，直到跨过工具轮次边界才「突然出现」；服务端 `activeSubagentRuns` 改为返回 `{taskId, toolUseId}[]` 且**身份无总量也下发**（长生成期才是身份最要紧的时候）。② **服务端在飞外推**（新增 `agentRunUsageProjection.ts`）：在 `notifyOutputCallbacks` 之前按 run 计数（镜像客户端的 delta 规则**及「哪些不计」**），种子取 `max(rollup, projection)` ⇒ 后加入者不再从 0 起，且**估计绝不盖过终局真值**。③ 基准被采用后**必须记账**（`lastWritten = reported`），否则「无变化的写入被跳过」会让数字永远爬不动。④ 轮次页脚补 `text-[11px]`（5 文件→11 文件） |

## 明细

### 原链位 63 — `subagent-usage-cross-client`

- 需求背景：用户反馈 A 客户端发起的会话能看到实时用量，B 客户端打开同一会话「有很长一段时间看不到用量爬升」；修身份后 B 能看到但从 0 开始、没跟 A 一致。两个根因都修完才对得上。
- 方案：
  - 根因一（真根因，身份对齐）：`runAgentId`（run 自己的 id，6 位 hex）与 `tool_use_id`（派发它的 Agent 工具调用 id，`call_00_…`）是两个 id，UI 按 `toolUseId` 读、实时写入方 `ingestSubagentLiveUsage` 建无既有行时却填 `toolUseId=agentId`（runAgentId）⇒ 后加入客户端 B 的行永远读不到（数字突然出现=某子代理跨工具轮次边界后 `task_progress` 带来真 id 才改写）。修法：服务端 `activeSubagentIds` → `activeSubagentRuns` 返回 `{taskId, toolUseId}[]`，`runningAgentUsage` 每项带两个 id，「没有总量也要发」（`totalTokens` 可选、`taskId`/`toolUseId` 必需），客户端种子行按 run id 作键并携带 tool-call id；
  - 根因二：后加入者基线只有分界粒度、从 0 起 → 新增服务端在飞外推器 `agentRunUsageProjection.ts`，计数点在 `conversationService.notifyOutputCallbacks` 之前（每会话每消息恰一次），规则刻意镜像客户端（`text_delta`/`input_json_delta`→text、`thinking_delta`→thinking、`/4` 估 token），并镜像「哪些不计」；种子取 `max(rollup, projection)`，完成时终态通知仍权威；
  - 顺带修：rebase 后就 `acc.lastWritten = reported`（采用基准即记账），避免「无变化就 return」把累加清零的死循环。
- 验证：身份对齐核心回归（种 `{taskId:'a74ce8',toolUseId:'call_00_x'}` + 喂 `runAgentId` 帧 ⇒ 写落同一行、爬过种子、只有一行）；服务端 `activeSubagentRuns` 5 例、路由 11 例、投影 10 例（含镜像回归）；`chatStore` 380/380；`check:server` 496 文件 5975 条 0 失败；链 63/63 apply 0 失败；真机用户确认 B 与 A 数值一致。
