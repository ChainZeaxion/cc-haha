# 56-session-find-bounded-read — findSessionFile 有界读（链位 56，56-session-find-bounded-read.patch）

> 功能组：pr-4 — 文件下载桥接 + 大会话打开提速（pr-prepare/pr-11/）
> 链位 56，patch `56-session-find-bounded-read.patch`（本目录）

- 需求背景：链位 55 修掉归属投影后用户实测「还是慢」。给 `getSessionSummary` 各步骤加 env 门控临时计时后定位：重复开销在 `findSessionFile`（单次 4–6 秒）——`hasConversationTranscript` 判「有没有真实对话」时把整个文件读完 + 逐行 JSON.parse，而同一 session id 在多个发现根下各有一份（139.7MB + 184.5MB）⇒ 每次解析约 320MB，且该函数几乎在每个会话端点上。
- 方案：这是**存在性**问题，读到第一个合格条目即可回答。新增 `hasConversationTranscriptInFile`：只读文件头、**命中即停**，设 8MB 上限兜底「头部全是元数据」的病态文件（该标志只用于多匹配间排序，上限语义代价小）。
- 验证：`findSessionFile` **4345–6065ms → 2–8ms**（约 1000 倍）；「老会话打不开」(13.5MB) 冷首开 0.71s → 之后 ~30ms；「…时间线交叉」(139.7MB×2) 热态连打 6 次 **0.010–0.017s**（改前 6.5/14.6/6.9s 且不随请求次数改善）。
