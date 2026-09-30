# 55-session-history-context-durable — 归属投影落盘（链位 55，55-session-history-context-durable.patch）

> 功能组：pr-4 — 文件下载桥接 + 大会话打开提速（pr-prepare/pr-4/）
> 链位 55，patch `55-session-history-context-durable.patch`（本目录）

- 需求背景：用户报「老会话打不开」，实为打开 40,119 条消息的会话「一直转圈」。逐项证伪（打开门槛/vcc 扫盘/git/索引 DB 查询）后锁定：`GET /api/sessions/<id>` 取一页要 `projectHistoryPageEntries` 为算 `parent_tool_use_id` **把整个转录从头扫一遍**——默认 2,949ms / 193MB 扫描，`projectContext:false` 仅 6ms，慢约 500 倍。且索引存 `mkdtemp` + 内存 Map 仅 4 项 + `exit` 即删 ⇒ 每次重启/淘汰重扫，`/tmp` 还累积了 634 目录 / 92MB 泄漏。
- 方案：索引的可续跑状态（identity/size/mtime/offset/suppressed/fingerprint）写进 DB `meta` 表、与 context 行**同事务提交**（索引永不与自身内容矛盾）；索引文件放稳定路径 `<cc-haha>/db/history-context-v1/<sha256(路径)>.sqlite`（`CC_HAHA_HISTORY_CONTEXT_DIR` 可覆盖）；淘汰只 close 不删文件，`pruneOnce()` 每进程一次、删 7 天未动索引；所有失效判定原样保留（正确性不变，只把「进程内易失」改为「跨进程可用」）。
- 验证（跨进程=跨重启）：冷启动 **2,949ms → 第 2 进程 37ms → 第 3 进程 36ms**（后两次 `ctxScan=0`）；索引文件仅 3.3MB；`sessionHistoryContext.test.ts` 8/8（新增：冷启动复用落盘索引、冷启动仍拒绝被替换的转录）；`check:server` 493 文件 5952 通过 0 失败。
