# 57-transcript-metadata-durable — 元数据投影落盘（链位 57，57-transcript-metadata-durable.patch）

> 功能组：pr-4 — 文件下载桥接 + 大会话打开提速（pr-prepare/pr-4/）
> 链位 57，patch `57-transcript-metadata-durable.patch`（本目录）

- 需求背景：链位 55/56 解决「重复开销」后，冷进程**首次**打开超大会话仍要 9.6s——`getMetadataProjection` 要算 messageCount/最后时间戳/launchCount 等，**本就需要一次全量遍历**（不能靠「少读」解决），而此前只在内存缓存（上限 32），进程重启即失；且同 session 两份拷贝各建一次。
- 方案：投影结果是几 KB 纯标量，落盘：新增 `transcriptMetadataCache`，路径 `<cc-haha>/db/transcript-metadata-v1/<sha256(configDir+文件路径)>.json`（`CC_HAHA_TRANSCRIPT_METADATA_DIR` 可覆盖）；写 tmp+rename（读者不见半写），失败静默；读**只认同 signature**（`dev:ino:size:mtimeNs`）且 `projectDir` 相同 ⇒ 陈旧条目代价是重扫、绝不给错答案；每进程最多扫一次、删 7 天未动条目；顺带把「上限 32」容量守卫抽成 `enforceMetadataProjectionCacheCapacity()` 复用。
- 验证（两个独立冷进程）：冷启动首开 **10.24s → 第 2 次冷启动 0.016s**；落盘条目仅 1.3–1.9KB；真实会话冷首开「老会话打不开」(13.5MB) 0.76s 后 ~29ms、「…时间线交叉」(139.7MB+184.5MB) **0.027s**（改前 9.29s）。测试写法：转录 `chmod 000` 后读——`fs.stat` 仍成功但重扫必 EACCES，能返回正确值即证明命中来自落盘（root 下跳过）。
