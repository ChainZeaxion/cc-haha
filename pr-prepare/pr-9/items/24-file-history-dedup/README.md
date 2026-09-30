# 24-file-history-dedup — file-history `-completed-*` 重复消除（链位 24，`24-file-history-dedup.patch`，对应文档 E 项）

> 功能组：pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）（pr-prepare/pr-9/）
> 链位 24，patch `24-file-history-dedup.patch`（本目录）

- 需求背景：`fileHistoryCompleteSnapshot` 原来是每轮对每个被追踪文件无条件 `copyFile`，且追踪集只增不减 ⇒ O(文件数 × 轮数) 份拷贝、绝大多数逐字节相同。实测该目录 1512MB / 15494 文件，却只有 2057 种内容（87% 是重复），估算可回收 1171MB（77%）。
- 方案：套用 `fileHistoryMakeSnapshot` 既有惯用法 `checkOriginFileChanged()`——内容未变则复用上一轮的 `-completed-` 备份，仅在真变化时才建新拷贝；沿用 `-completed-` 命名，不动 rewind 的 after-boundary 语义。
- 验证：`fileHistory.security.test.ts` 覆盖；与 G 等 patch 一同纳入全量验证（2026-09-26）：`bun test src/server/` 3452 pass / 0 fail（178 文件），四 patch 链式应用后与工作树 diff 逐字节一致。
