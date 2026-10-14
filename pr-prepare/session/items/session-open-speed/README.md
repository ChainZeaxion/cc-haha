# session-open-speed — 大会话打开提速（原链位 55,56,57）

> 功能主题：`session` — 会话及相关优化（会话基础 + 文件下载 + 大会话加载/传输性能 + 打开提速）（`pr-prepare/session/`）｜ PR 分支 `session-related-optimizations`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/session/session-open-speed-patch1.patch`（6 文件 +526−22）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 55 | `session-history-context-durable` | 五 补记：**打开大会话「一直转圈」＝归属投影全量扫盘**——为一个 40,119 条消息的会话取一页要**扫 193MB / 2,949ms**（跳过投影仅 6ms）；索引原存 `mkdtemp`+内存 4 项+exit 即删 ⇒ 每次重启/淘汰重扫，还泄漏 634 目录/92MB。改为**索引落盘**（meta 表同事务存 identity/size/mtime/offset/suppressed/指纹，稳定路径 + 每周清理），**跨进程 2,949ms→37ms**（2 文件） |
| 56 | `session-find-bounded-read` | 五 补记二：**大会话一直转圈＝`findSessionFile` 全量解析转录**——判定「有没有真实对话」时把整个文件读完+逐行 JSON.parse，而同一 id 在多个发现根下各有一份（139.7MB+184.5MB）⇒ 每次解析约 320MB，**单次 4–6 秒**，且几乎每个会话端点都走它。改为只读文件头、命中即停（8MB 上限）。findSessionFile **4345→2ms**，大会话热态打开 **6.9s→0.010s**（2 文件） |
| 57 | `transcript-metadata-durable` | 五 补记三：**元数据投影落盘**——冷进程首开大会话仍要 9.6s（该投影本就需要一次全量遍历算 messageCount/最后时间戳，且两份拷贝各建一次）；投影是几 KB 纯标量 ⇒ 落盘 + 只认同 signature，**10.24s → 0.016s**（链位 57/58 治重复开销，本条治冷启动）（3 文件） |

## 明细

### 原链位 55 — `session-history-context-durable`



### 原链位 56 — `session-find-bounded-read`



### 原链位 57 — `transcript-metadata-durable`
