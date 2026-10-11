# 52-split-no-double-count — 拆分「真实用量 0」修复——估算与真值双计（链位 52，`52-split-no-double-count.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 52，patch `52-split-no-double-count.patch`（本目录）

- 需求背景：改动后用户反馈「未思考的用量是 0，思考的用量是真实用量，要修正」。取证实录显示一轮响应被拆成两条 assistant 记录（思考一条、正文一条，**共享 `message.id`**），只有带 usage 的那条能报 reasoning。
- 方案：
  - 根因：31165 字符的思考被估算（≈8.9k），又叠上同响应真实 6777 ⇒ think 15.7k > total 9.3k ⇒ 界面 `Math.max(0, total - think)` 恒为 0；
  - 修法：按**响应 id 归组**，某响应报了真值就丢弃它先前那条拆分记录的估算；CLI 侧 `LocalAgentTask.tsx` tracker 新增 `thinkingEstimatesByResponse: Map<id, number>`（`reported>0` 时先减同 id 估算再计真值）；服务端 `sessionUsageRollup.computeSubagentUsage` 批量版「有真值的响应不采用估算」；无 `message.id` 的记录维持逐条行为；两处各加一条钉住该形状的测试。
- 验证（真实数据，dev 实例）：6 个子代理比对新代码 API 返回 vs 独立期望值 6/6 完全一致，非思考分量由 0 变为 3332/2523/3654/4286/4192/2721；该会话 66 条带 usage 通知中 `think > total` 0 条；Σtotal=798,076、Σthink=506,819 ⇒ 非思考 291,257。
