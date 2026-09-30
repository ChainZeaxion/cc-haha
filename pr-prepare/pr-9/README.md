# pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）

## 功能域概述

本组治理「大体积会话打不开/加载慢」问题：一方面消除历史记录中 `toolUseResult.originalFile`（Edit/Write 落盘的改前整文件）造成的数据膨胀（传输层有界投影、读取预算收紧、file-history 去重、写入侧 16KB 裁剪），另一方面为 H5 远端 API 响应引入 gzip 压缩传输（非本机默认开启、会话 >10MB 门控、异步化不阻塞事件循环）。两者共同作用，使超大会话的打开、翻页与远端同步显著提速且不再白屏。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. H5 远端 API 响应 gzip 压缩传输（链位 20，`20-h5-gzip-transport.patch`）

- 需求背景：用户反馈 H5 访问会话疑似发送全量消息记录，希望非本机访问时默认启用压缩传输以省带宽、提速。实测坐实前提：H5 打开会话 = `getFullHistory` 先 `mode=full` 再逐页 cursor 拉全量历史，生产 193MB 会话实测 wire 139MB / 701 页 / 25.9s（loopback）。而 `Bun.serve` 无 compression 选项，全仓无 content-encoding 中间件。
- 方案：
  - 新增 `src/server/responseCompression.ts`：`shouldGzipResponse`（门控）+ `withGzipIfEligible`（压缩）；门控 = 仅 GET 200 + `Accept-Encoding` 含 gzip + 非 loopback + content-type json + >128KB（`MIN_COMPRESS_BYTES`）；`gzipSync level 6`。
  - `src/server/index.ts` `/api` 分支一行接线；客户端零改动（浏览器 fetch 透明解压 gzip）。
  - env 开关：`CC_HAHA_TRANSPORT_GZIP=0` 关 / `=1` 强制 loopback 也压（测试用）；前 5 次压缩打日志。
- 验证：dev 7788 E2E（LAN IP 触发 vs 127.0.0.1 基线，同一大会话）：wire 136.19MB → 43.09MB（**-68%**），解压后逐字节一致（27984 条 / 705 页全对齐）；705 页中 485 页压缩、<128KB 小页正确透传；loopback `gz_pages=0` 桌面零影响；server 全量 3442 pass / 0 fail。
- 踩坑：`response.arrayBuffer()` 消耗 body 后回退路径直接 `return response` 会致客户端收到 200+空 body，回退必须 `new Response(raw, {status, headers})` 重建；Bun 的 `Response.text()` 不透明解压 gzip，单测须手动 `gunzipSync` 模拟客户端视角。

### 2. 历史传输裁剪 + 读取预算收紧（链位 23，`23-history-transport-bounds.patch`，对应文档 A+H 项）

- 需求背景：大体积会话白屏真因：客户端首个 `mode=full` 请求撞 120s 超时（诊断日志 ×12，含仅 13.6MB 的会话），阻塞式 `await getFullHistory` 永不 resolve → 白屏。膨胀源为 `toolUseResult.originalFile`：本会话 20 条 >1MB 记录共 78.6MB（占 66%），全局 518 个 transcript 共 3.0GB。
- 方案：
  - **A（读取层有界投影）**：`boundedSessionHistory.ts` 新增 `boundToolUseResultPreview()`，`sessionService.entryToMessage` 接入——传输层只截超长字符串（>16KB），键与容器类型全保留；**不置 `bodyTruncated`**（避免翻转 `historyComplete=false` 触发 recovery 循环）；仅作用于展示/传输路径，recovery 与语义归约路径仍取原始记录。
  - **H（预算收紧）**：`HISTORY_FULL_BYTES` 32MB → **8MB**；**配对** `HISTORY_FULL_SCAN_BYTES` 64MB → **24MB**（=3×输出；扫描预算才是延迟上界，只降输出会允许「读 64MB 吐 8MB」）。
- 验证：真实会话 `db39b34d`（1844 条 toolUseResult）：toolUseResult 合计 106.6MB → **6.6MB（-93.8%）**；单条最大 3.93MB → 48KB；`mode=full` 单响应上限 33.2MB → ≤8MB。保留性：`filePath` 原样、`structuredPatch` 未被截（hunk 完整）、`originalFile` 仍为字符串（满足 schema 必填 `z.string()` 与 UI 无保护 `.split`）。测试：`boundedSessionHistory` 21/21、会话相关服务端测试 342/342、新增 3 个专项用例（截断保键、小结果字节不变、不置 `bodyTruncated`）。

### 3. file-history `-completed-*` 重复消除（链位 24，`24-file-history-dedup.patch`，对应文档 E 项）

- 需求背景：`fileHistoryCompleteSnapshot` 原来是每轮对每个被追踪文件无条件 `copyFile`，且追踪集只增不减 ⇒ O(文件数 × 轮数) 份拷贝、绝大多数逐字节相同。实测该目录 1512MB / 15494 文件，却只有 2057 种内容（87% 是重复），估算可回收 1171MB（77%）。
- 方案：套用 `fileHistoryMakeSnapshot` 既有惯用法 `checkOriginFileChanged()`——内容未变则复用上一轮的 `-completed-` 备份，仅在真变化时才建新拷贝；沿用 `-completed-` 命名，不动 rewind 的 after-boundary 语义。
- 验证：`fileHistory.security.test.ts` 覆盖；与 G 等 patch 一同纳入全量验证（2026-09-26）：`bun test src/server/` 3452 pass / 0 fail（178 文件），四 patch 链式应用后与工作树 diff 逐字节一致。

### 4. gzip 传输改造：同步→异步 + 会话大小门控（链位 25，`25-gzip-transport.patch`，对应文档 G+G2 项）

- 需求背景：`gzipSync` 在事件循环上完成整个 deflate，而远端历史正是「多页顺序拉取」，每页都会把其他请求连同翻页循环一起卡住。另用户明确指示：gzip 压缩传输只有**整个会话大于 10MB** 才开启。
- 方案：
  - **G（异步化）**：`responseCompression.ts` 改为 `node:zlib` 异步 `gzip`（libuv 线程池），移出事件循环。
  - **G2（会话门控）**：新增 `MIN_COMPRESSIBLE_SESSION_BYTES = 10MB`、`sessionIdFromPath()`；`withGzipIfEligible` 增第 4 参 `resolveSessionSize?`；`server/index.ts` 新增 `resolveSessionSizeBytes()`（`findSessionFile` + `stat`，10s TTL 缓存）注入中间件。
  - 设计要点：门控放异步路径最后（先过 GET/200/json/协商/非 loopback 等便宜检查）；`shouldGzipResponse` 签名不变（既有 3 参测试不受影响）；查不到大小（null）→ 回落为压缩；每响应 128KB 底线保留，与会话 10MB 底线同时生效；10s TTL 缓存让 H5 翻页（数百次请求）只查一次。
  - G 与 G2 同改 `responseCompression.ts`，分两个 patch 会顺序应用冲突，故合并为单 patch。
- 验证：裁剪后真实会话（18.9MB JSON）压缩比率 3.5–6.0x（32KB→9KB 3.5x/0.9ms；128KB→29KB 4.4x/2.4ms；1MB→217KB 4.7x/16ms；8MB→1.36MB 6.0x/102ms）。附带发现并用测试钉住：Bun `Response.json()` 不设 `content-length`，「按声明长度快速跳过」从不触发，小响应会先被 `arrayBuffer()` 缓冲后再判定（有 10s 缓存，成本可忽略）。

### 5. 首屏翻页上限（链位 26，`26-history-first-paint-bound.patch`，对应文档 B 项）

- 需求背景：`getFullHistory` 从 `mode=full` 起按 `nextCursor` **无上限**拼接，且结束时把 `nextCursor` 置 null。两个后果：①时间线在整个拼接完成前不渲染 → 深会话表现为「打不开」（超预算记录独占一页，实测 152 页未完成）；②`MessageList` 的「加载更早」入口条件是 `historyWindowed && historyPage.nextCursor`，而 `nextCursor` 恒为 null ⇒ 既有分页链路永远不可达。
- 方案：`desktop/src/api/sessions.ts` 拼接循环加 `HISTORY_STITCH_MAX_PAGES = 40` 与 `HISTORY_STITCH_DEADLINE_MS = 12_000` 两个上界，越界即 break；返回改为 `nextCursor: cursor`、`hasMore: !exhausted`，`historyComplete` 仅在真正走完（`cursor === null`）时才可能为 true。
- 验证：`cursor === null`（走完）时各字段与旧的「无条件 null」行为完全一致——提前返回是唯一新增路径，既有 23 个测试一字未改即通过（`desktop/src/api/sessions` 24/24）。效果：首屏不再阻塞，剩余历史由既有「加载更早」按钮接管（每点一次 prepend 一页）。
- 备注（有意不做的一半）：`projectContext:false`（绕开 `projectHistoryPageEntries` 全文件重建 ownership 索引，该重建很可能是 13.6MB 会话也超时的元凶）——但该索引产出父子 tool-activity 归属，渲染层依赖它把子代理活动并入主时间线，关掉即丢功能，故不擅自实施，建议做成「首屏 `projectContext:false` + 后台补索引」两步。

### 6. 基线真缺陷修复：typecheck（链位 27，`27-baseline-typecheck-fixes.patch`）

- 需求背景：全量验证时发现两处 tsc 基线错误需修复以让本组改动文件「0 新增错误」的口径成立：`src/server/index.ts` 的 TS2502（参数遮蔽致类型自引用，经暂存法核验为既有基线：HEAD 在 281 行，加 36 行后位移至 317）与 vendor 重复导入 TS2300。
- 方案：修复 `src/server/index.ts` 的 TS2502 参数遮蔽（类型自引用）与 `src/vendor/computer-use-mcp` 的重复导入 TS2300（+7/−4，2 文件）。
- 验证：本组 patch 应用后改动文件 tsc 0 新增错误；`src/server` 全量测试保持全绿（见组级验证口径）。

### 7. 存量瘦身：写入侧 `originalFile` 16KB 有界裁剪（链位 31，`31-storage-original-file-bound.patch`，对应文档 F 项）

- 需求背景：`originalFile` 是编辑前的整文件，模型看不到（走 API 的是 `mapToolResultToToolResultBlockParam`），编辑卡片的 diff 实际读 `structuredPatch`，但实测该字段占 transcript 约 2/3（3.1GB 中 2.1GB）。需写入侧收口治根本。
- 方案：`sessionStorage.ts` 新增 `boundOriginalFileForStorage()`，在 `cleanMessagesForLogging()` 落盘路径上对 `toolUseResult.originalFile` 施加 **16KB** 上限，并写 `originalFileTruncated: true` / `originalFileBytes: <原长>` 让记录自证被裁。上限取 `TOOL_USE_RESULT_STRING_LIMIT`（16KB，`boundedSessionHistory.ts`）同一个数——客户端历来的预览就是这个界，故源侧裁剪不改变任何人可见的内容。只裁这一个字段：其它 `toolUseResult` 字段会被 recovery / 语义归约路径读回，必须保留原样。
- 验证：专项测试 `sessionStorage.originalFileBound.test.ts`（小结果不动、超限裁剪且标记正确、非字符串/非对象透传）与 `pipInstall` 合并跑 15/15 通过；改动文件 tsc 0 报错。存量数据一次性瘦身（前置全量备份 `/mnt/data1/claude-backup-20260927-023315/`）：`~/.claude/projects` 总量 3.1GB → **1.2GB（-61%）**；最大会话 359MB → 61MB、297MB → 7.5MB、261MB → 13MB、186MB → 17MB、119MB → 19MB。

## 验证口径（组级）

- 2026-09-26 全量验证（A+B+E+G 四个 patch 链式应用后）：服务端 `bun test src/server/` **3452 pass / 0 fail**（178 文件）；`desktop/src/api/sessions` 24/24、`chatStore` 354/354；四 patch 链式应用后与工作树 diff **逐字节一致**；改动文件 tsc 0 新增错误。
- gzip 传输 E2E（dev 7788）：同一大会话 LAN vs loopback 对比，wire 136.19MB → 43.09MB（-68%），解压后逐字节一致（27984 条 / 705 页全对齐）。
- 传输裁剪实测（真实会话 `db39b34d`，1844 条 toolUseResult）：合计 106.6MB → 6.6MB（-93.8%），单条最大 3.93MB → 48KB，`mode=full` 单响应上限 33.2MB → ≤8MB。
- 写入侧裁剪（F）：专项 15/15 通过；存量一次性瘦身 3.1GB → 1.2GB（-61%）（备份即回滚点，重放 patch 不重复改写历史文件）。

## 与其他组的关系

pr-4（下载与打开提速，含 anchor 导航下载、findSessionFile 只读文件头等）与本组同属**大体积会话性能**域：pr-4 解决的是「打开慢/下载不可用」（索引与传输入口），本组解决的是「大会话历史本身太大」（数据膨胀治理 + 压缩传输）。两者叠加后，13.5MB–139.7MB 级会话的冷首开与远端同步都受益；实现文件基本不重叠，合并上游时互不冲突。

## 风险与备注

- **上游冲突风险文件（⚠️ 上游 main 也改过）**：`src/server/index.ts`、`src/server/services/sessionService.ts`、`desktop/src/types/chat.ts`。其中 `src/server/index.ts` 本组有 3 处独立接线（gzip 中间件、`resolveSessionSizeBytes` 注入等），重放前需先对上游 diff 做三方合并核对。
- 硬约束（评审时须说明，勿「顺手」改）：
  - `originalFile` 是 schema 必填 `z.string()` 且 `FileEditTool/UI.tsx:90` 无保护 `.split` ⇒ **只能裁成字符串预览，不能删字段**；
  - `toolUseResult` 对象不可整体删除（被 `isHumanTurn` 等当「非人类消息」判别位）；
  - 新增键只能进 `toolUseResult` 内部（顶层键序被 transcript 解析优化依赖）；
  - 展示层裁剪切忌置 `bodyTruncated`——会翻转 `historyComplete=false` → recovery 循环 + `historyWindowed` 横幅误显。
- C 方案（裁 `originalFile` 指向 file-history 备份）已被**实测证伪**（20 个巨型 `originalFile` 中 15 个备份里没有，裁了即永久丢失），当前以 A（传输层）+ E（存量去重）+ F（写入侧裁剪）替代；D（按需端点取回原文）待重估，不在本 PR。
- H（预算收紧）单独改会让页数变多，**须与 A 同批落地**（本 PR 内两者同在链位 23，满足）；真正的耗时上界是扫描预算 `HISTORY_FULL_SCAN_BYTES`，已配对 64MB → 24MB。
- F 的生效边界：写入侧裁剪**只约束此后的新写入**；存量瘦身是一次性数据操作，不属于 patch 可重复效果。
- 会话 10MB 门控（G2）是用户明确决策，属保守选择：小会话放弃压缩换零 CPU，大会话行为不变；每响应 128KB 底线（`MIN_COMPRESS_BYTES`）保留，两者同时生效。
- 生效方式：除链位 26（前端 `desktop/src/api/sessions.ts`，须 `vite build`）外，其余均为 server 侧，重启 sidecar 即生效。
