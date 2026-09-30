# 39-subagent-background-task-durations — 子代理耗时 + 子代理收纳栏总耗时 + 后台任务耗时（链位 39，`39-subagent-background-task-durations.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 39，patch `39-subagent-background-task-durations.patch`（本目录）

- 需求背景：用户要求「给所有子代理加执行耗时，子代理收纳栏加总耗时统计，所有后台执行任务加耗时信息，并入 think 耗时优化项」。展示规格：汇总行带中文标签「派遣了 N 个子代理 · 总耗时 x · 状态」（靠右），每条子代理行插裸数字，activity 面板行/详情卡右侧加耗时。
- 方案：
  - **汇总栏 = 区间并集跨度（wall-clock span），不是各子代理耗时之和**——子代理是并发派发，串行才可求和；每个 run 先求区间 `{startMs,endMs}`（`agentRunInterval`：start=父会话 Agent `tool_use` timestamp，end=有上报取 `start+usage.durationMs`，否则 `tool_result.timestamp`），汇总 `agentGroupSpanMs = max(end) - min(start)`；
  - 单行数字取该 run 自身长度 `end - start`（`agentRunDurationMs`）；全 Agent 组走 `AgentToolGroup` 短路进不了 `ActivityGroup`，故另立 `agentRunInterval`/`agentGroupSpanMs`；
  - 数字格式用工具徽章同款 `formatDuration`（紧凑 `5m12s`）；activity 面板保留自身既有 `formatBackgroundDuration`；
  - 上报值优先、时间戳回退；`0` 不算测量值；未 settled 的同步 run 不显示数字。
- 验证：`ActivityGroup.test` 6 条（含并发三 run 取跨度 121s 且断言 ≠ 求和 361.5s）；新建 `ToolCallGroup.test` 4 条端到端（两代理错开 199s 发起→汇总跨度 `8m19s` ≠ 串行和 `7m0s`，同时发起两 run 汇总=`2m0s` 非 `4m0s`）；桌面 `tsc --noEmit` 0 错。
