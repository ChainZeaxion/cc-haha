# 31-storage-original-file-bound — 存量瘦身：写入侧 `originalFile` 16KB 有界裁剪（链位 31，`31-storage-original-file-bound.patch`，对应文档 F 项）

> 功能组：pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）（pr-prepare/pr-9/）
> 链位 31，patch `31-storage-original-file-bound.patch`（本目录）

- 需求背景：`originalFile` 是编辑前的整文件，模型看不到（走 API 的是 `mapToolResultToToolResultBlockParam`），编辑卡片的 diff 实际读 `structuredPatch`，但实测该字段占 transcript 约 2/3（3.1GB 中 2.1GB）。需写入侧收口治根本。
- 方案：`sessionStorage.ts` 新增 `boundOriginalFileForStorage()`，在 `cleanMessagesForLogging()` 落盘路径上对 `toolUseResult.originalFile` 施加 **16KB** 上限，并写 `originalFileTruncated: true` / `originalFileBytes: <原长>` 让记录自证被裁。上限取 `TOOL_USE_RESULT_STRING_LIMIT`（16KB，`boundedSessionHistory.ts`）同一个数——客户端历来的预览就是这个界，故源侧裁剪不改变任何人可见的内容。只裁这一个字段：其它 `toolUseResult` 字段会被 recovery / 语义归约路径读回，必须保留原样。
- 验证：专项测试 `sessionStorage.originalFileBound.test.ts`（小结果不动、超限裁剪且标记正确、非字符串/非对象透传）与 `pipInstall` 合并跑 15/15 通过；改动文件 tsc 0 报错。存量数据一次性瘦身（前置全量备份 `/mnt/data1/claude-backup-20260927-023315/`）：`~/.claude/projects` 总量 3.1GB → **1.2GB（-61%）**；最大会话 359MB → 61MB、297MB → 7.5MB、261MB → 13MB、186MB → 17MB、119MB → 19MB。
