# 25-gzip-transport — gzip 传输改造：同步→异步 + 会话大小门控（链位 25，`25-gzip-transport.patch`，对应文档 G+G2 项）

> 功能组：pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）（pr-prepare/pr-9/）
> 链位 25，patch `25-gzip-transport.patch`（本目录）

- 需求背景：`gzipSync` 在事件循环上完成整个 deflate，而远端历史正是「多页顺序拉取」，每页都会把其他请求连同翻页循环一起卡住。另用户明确指示：gzip 压缩传输只有**整个会话大于 10MB** 才开启。
- 方案：
  - **G（异步化）**：`responseCompression.ts` 改为 `node:zlib` 异步 `gzip`（libuv 线程池），移出事件循环。
  - **G2（会话门控）**：新增 `MIN_COMPRESSIBLE_SESSION_BYTES = 10MB`、`sessionIdFromPath()`；`withGzipIfEligible` 增第 4 参 `resolveSessionSize?`；`server/index.ts` 新增 `resolveSessionSizeBytes()`（`findSessionFile` + `stat`，10s TTL 缓存）注入中间件。
  - 设计要点：门控放异步路径最后（先过 GET/200/json/协商/非 loopback 等便宜检查）；`shouldGzipResponse` 签名不变（既有 3 参测试不受影响）；查不到大小（null）→ 回落为压缩；每响应 128KB 底线保留，与会话 10MB 底线同时生效；10s TTL 缓存让 H5 翻页（数百次请求）只查一次。
  - G 与 G2 同改 `responseCompression.ts`，分两个 patch 会顺序应用冲突，故合并为单 patch。
- 验证：裁剪后真实会话（18.9MB JSON）压缩比率 3.5–6.0x（32KB→9KB 3.5x/0.9ms；128KB→29KB 4.4x/2.4ms；1MB→217KB 4.7x/16ms；8MB→1.36MB 6.0x/102ms）。附带发现并用测试钉住：Bun `Response.json()` 不设 `content-length`，「按声明长度快速跳过」从不触发，小响应会先被 `arrayBuffer()` 缓冲后再判定（有 10s 缓存，成本可忽略）。
