# pr-11 — 大会话打开提速

> 分支 `pr/session-open-speedup`，基座 `068b3ebd`。功能域：大会话打开提速：git-info 持久化投影 + findSessionFile 只读文件头 + 元数据投影冷启动落盘

## 优化项

### 55. 归属投影落盘（链位 55，55-session-history-context-durable.patch）（链位 55，`55-session-history-context-durable.patch`）
- 需求背景：用户报「老会话打不开」，实为打开 40,119 条消息的会话「一直转圈」。逐项证伪（打开门槛/vcc 扫盘/git/索引 DB 查询）后锁定：`GET /api/sessions/<id>` 取一页要 `projectHistoryPageEntries` 为算 `parent_tool_use_id` **把整个转录从头扫一遍**——默认 2,949ms / 193MB 扫描，`projectContext:false` 仅 6ms，慢约 500 倍。且索引存 `mkdtemp` + 内存 Map 仅 4 项 + `exit` 即删 ⇒ 每次重启/淘汰重扫，`/tmp` 还累积了 634 目录 / 92MB 泄漏。
- 方案：索引的可续跑状态（identity/size/mtime/offset/suppressed/fingerprint）写进 DB `meta` 表、与 context 行**同事务提交**（索引永不与自身内容矛盾）；索引文件放稳定路径 `<cc-haha>/db/history-context-v1/<sha256(路径)>.sqlite`（`CC_HAHA_HISTORY_CONTEXT_DIR` 可覆盖）；淘汰只 close 不删文件，`pruneOnce()` 每进程一次、删 7 天未动索引；所有失效判定原样保留（正确性不变，只把「进程内易失」改为「跨进程可用」）。
- 验证（跨进程=跨重启）：冷启动 **2,949ms → 第 2 进程 37ms → 第 3 进程 36ms**（后两次 `ctxScan=0`）；索引文件仅 3.3MB；`sessionHistoryContext.test.ts` 8/8（新增：冷启动复用落盘索引、冷启动仍拒绝被替换的转录）；`check:server` 493 文件 5952 通过 0 失败。

### 56. findSessionFile 有界读（链位 56，56-session-find-bounded-read.patch）（链位 56，`56-session-find-bounded-read.patch`）
- 需求背景：链位 55 修掉归属投影后用户实测「还是慢」。给 `getSessionSummary` 各步骤加 env 门控临时计时后定位：重复开销在 `findSessionFile`（单次 4–6 秒）——`hasConversationTranscript` 判「有没有真实对话」时把整个文件读完 + 逐行 JSON.parse，而同一 session id 在多个发现根下各有一份（139.7MB + 184.5MB）⇒ 每次解析约 320MB，且该函数几乎在每个会话端点上。
- 方案：这是**存在性**问题，读到第一个合格条目即可回答。新增 `hasConversationTranscriptInFile`：只读文件头、**命中即停**，设 8MB 上限兜底「头部全是元数据」的病态文件（该标志只用于多匹配间排序，上限语义代价小）。
- 验证：`findSessionFile` **4345–6065ms → 2–8ms**（约 1000 倍）；「老会话打不开」(13.5MB) 冷首开 0.71s → 之后 ~30ms；「…时间线交叉」(139.7MB×2) 热态连打 6 次 **0.010–0.017s**（改前 6.5/14.6/6.9s 且不随请求次数改善）。

### 57. 元数据投影落盘（链位 57，57-transcript-metadata-durable.patch）（链位 57，`57-transcript-metadata-durable.patch`）
- 需求背景：链位 55/56 解决「重复开销」后，冷进程**首次**打开超大会话仍要 9.6s——`getMetadataProjection` 要算 messageCount/最后时间戳/launchCount 等，**本就需要一次全量遍历**（不能靠「少读」解决），而此前只在内存缓存（上限 32），进程重启即失；且同 session 两份拷贝各建一次。
- 方案：投影结果是几 KB 纯标量，落盘：新增 `transcriptMetadataCache`，路径 `<cc-haha>/db/transcript-metadata-v1/<sha256(configDir+文件路径)>.json`（`CC_HAHA_TRANSCRIPT_METADATA_DIR` 可覆盖）；写 tmp+rename（读者不见半写），失败静默；读**只认同 signature**（`dev:ino:size:mtimeNs`）且 `projectDir` 相同 ⇒ 陈旧条目代价是重扫、绝不给错答案；每进程最多扫一次、删 7 天未动条目；顺带把「上限 32」容量守卫抽成 `enforceMetadataProjectionCacheCapacity()` 复用。
- 验证（两个独立冷进程）：冷启动首开 **10.24s → 第 2 次冷启动 0.016s**；落盘条目仅 1.3–1.9KB；真实会话冷首开「老会话打不开」(13.5MB) 0.76s 后 ~29ms、「…时间线交叉」(139.7MB+184.5MB) **0.027s**（改前 9.29s）。测试写法：转录 `chmod 000` 后读——`fs.stat` 仍成功但重扫必 EACCES，能返回正确值即证明命中来自落盘（root 下跳过）。
