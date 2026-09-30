# 26-history-first-paint-bound — 首屏翻页上限（链位 26，`26-history-first-paint-bound.patch`，对应文档 B 项）

> 功能组：pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）（pr-prepare/pr-9/）
> 链位 26，patch `26-history-first-paint-bound.patch`（本目录）

- 需求背景：`getFullHistory` 从 `mode=full` 起按 `nextCursor` **无上限**拼接，且结束时把 `nextCursor` 置 null。两个后果：①时间线在整个拼接完成前不渲染 → 深会话表现为「打不开」（超预算记录独占一页，实测 152 页未完成）；②`MessageList` 的「加载更早」入口条件是 `historyWindowed && historyPage.nextCursor`，而 `nextCursor` 恒为 null ⇒ 既有分页链路永远不可达。
- 方案：`desktop/src/api/sessions.ts` 拼接循环加 `HISTORY_STITCH_MAX_PAGES = 40` 与 `HISTORY_STITCH_DEADLINE_MS = 12_000` 两个上界，越界即 break；返回改为 `nextCursor: cursor`、`hasMore: !exhausted`，`historyComplete` 仅在真正走完（`cursor === null`）时才可能为 true。
- 验证：`cursor === null`（走完）时各字段与旧的「无条件 null」行为完全一致——提前返回是唯一新增路径，既有 23 个测试一字未改即通过（`desktop/src/api/sessions` 24/24）。效果：首屏不再阻塞，剩余历史由既有「加载更早」按钮接管（每点一次 prepend 一页）。
- 备注（有意不做的一半）：`projectContext:false`（绕开 `projectHistoryPageEntries` 全文件重建 ownership 索引，该重建很可能是 13.6MB 会话也超时的元凶）——但该索引产出父子 tool-activity 归属，渲染层依赖它把子代理活动并入主时间线，关掉即丢功能，故不擅自实施，建议做成「首屏 `projectContext:false` + 后台补索引」两步。
