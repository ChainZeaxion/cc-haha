# session-history-transport — 历史传输边界 / 去重 / 首屏（原链位 23,24,26,31）

> 功能主题：`session` — 会话及相关优化（会话基础 + 文件下载 + 大会话加载/传输性能 + 打开提速）（`pr-prepare/session/`）｜ PR 分支 `session-related-optimizations`
> **单一真相源 patch**：`modify/patches/session/session-history-transport-patch1.patch`（9 文件 +363−16）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 23 | `history-transport-bounds` | 二十二 历史传输裁剪（`toolUseResult` 有界投影）+ 读取预算收紧 |
| 24 | `file-history-dedup` | 二十二 E file-history `-completed-*` 重复消除（变动才建） |
| 26 | `history-first-paint-bound` | 二十二 B 首屏翻页上限（提前返回并保留 `nextCursor`，打通既有「加载更早」） |
| 31 | `storage-original-file-bound` | 二十二 F **存量瘦身**：写入侧对 `toolUseResult.originalFile` 做 16KB 有界裁剪（+ `originalFileTruncated/Bytes` 标记，含新测试文件） |

## 明细

### 原链位 23 — `history-transport-bounds`

- 需求背景：大体积会话白屏真因：客户端首个 `mode=full` 请求撞 120s 超时（诊断日志 ×12，含仅 13.6MB 的会话），阻塞式 `await getFullHistory` 永不 resolve → 白屏。膨胀源为 `toolUseResult.originalFile`：本会话 20 条 >1MB 记录共 78.6MB（占 66%），全局 518 个 transcript 共 3.0GB。
- 方案：
  - **A（读取层有界投影）**：`boundedSessionHistory.ts` 新增 `boundToolUseResultPreview()`，`sessionService.entryToMessage` 接入——传输层只截超长字符串（>16KB），键与容器类型全保留；**不置 `bodyTruncated`**（避免翻转 `historyComplete=false` 触发 recovery 循环）；仅作用于展示/传输路径，recovery 与语义归约路径仍取原始记录。
  - **H（预算收紧）**：`HISTORY_FULL_BYTES` 32MB → **8MB**；**配对** `HISTORY_FULL_SCAN_BYTES` 64MB → **24MB**（=3×输出；扫描预算才是延迟上界，只降输出会允许「读 64MB 吐 8MB」）。
- 验证：真实会话 `db39b34d`（1844 条 toolUseResult）：toolUseResult 合计 106.6MB → **6.6MB（-93.8%）**；单条最大 3.93MB → 48KB；`mode=full` 单响应上限 33.2MB → ≤8MB。保留性：`filePath` 原样、`structuredPatch` 未被截（hunk 完整）、`originalFile` 仍为字符串（满足 schema 必填 `z.string()` 与 UI 无保护 `.split`）。测试：`boundedSessionHistory` 21/21、会话相关服务端测试 342/342、新增 3 个专项用例（截断保键、小结果字节不变、不置 `bodyTruncated`）。

### 原链位 24 — `file-history-dedup`

- 需求背景：`fileHistoryCompleteSnapshot` 原来是每轮对每个被追踪文件无条件 `copyFile`，且追踪集只增不减 ⇒ O(文件数 × 轮数) 份拷贝、绝大多数逐字节相同。实测该目录 1512MB / 15494 文件，却只有 2057 种内容（87% 是重复），估算可回收 1171MB（77%）。
- 方案：套用 `fileHistoryMakeSnapshot` 既有惯用法 `checkOriginFileChanged()`——内容未变则复用上一轮的 `-completed-` 备份，仅在真变化时才建新拷贝；沿用 `-completed-` 命名，不动 rewind 的 after-boundary 语义。
- 验证：`fileHistory.security.test.ts` 覆盖；与 G 等 patch 一同纳入全量验证（2026-09-26）：`bun test src/server/` 3452 pass / 0 fail（178 文件），四 patch 链式应用后与工作树 diff 逐字节一致。

### 原链位 26 — `history-first-paint-bound`

- 需求背景：`getFullHistory` 从 `mode=full` 起按 `nextCursor` **无上限**拼接，且结束时把 `nextCursor` 置 null。两个后果：①时间线在整个拼接完成前不渲染 → 深会话表现为「打不开」（超预算记录独占一页，实测 152 页未完成）；②`MessageList` 的「加载更早」入口条件是 `historyWindowed && historyPage.nextCursor`，而 `nextCursor` 恒为 null ⇒ 既有分页链路永远不可达。
- 方案：`desktop/src/api/sessions.ts` 拼接循环加 `HISTORY_STITCH_MAX_PAGES = 40` 与 `HISTORY_STITCH_DEADLINE_MS = 12_000` 两个上界，越界即 break；返回改为 `nextCursor: cursor`、`hasMore: !exhausted`，`historyComplete` 仅在真正走完（`cursor === null`）时才可能为 true。
- 验证：`cursor === null`（走完）时各字段与旧的「无条件 null」行为完全一致——提前返回是唯一新增路径，既有 23 个测试一字未改即通过（`desktop/src/api/sessions` 24/24）。效果：首屏不再阻塞，剩余历史由既有「加载更早」按钮接管（每点一次 prepend 一页）。
- 备注（有意不做的一半）：`projectContext:false`（绕开 `projectHistoryPageEntries` 全文件重建 ownership 索引，该重建很可能是 13.6MB 会话也超时的元凶）——但该索引产出父子 tool-activity 归属，渲染层依赖它把子代理活动并入主时间线，关掉即丢功能，故不擅自实施，建议做成「首屏 `projectContext:false` + 后台补索引」两步。

### 原链位 31 — `storage-original-file-bound`

- 需求背景：`originalFile` 是编辑前的整文件，模型看不到（走 API 的是 `mapToolResultToToolResultBlockParam`），编辑卡片的 diff 实际读 `structuredPatch`，但实测该字段占 transcript 约 2/3（3.1GB 中 2.1GB）。需写入侧收口治根本。
- 方案：`sessionStorage.ts` 新增 `boundOriginalFileForStorage()`，在 `cleanMessagesForLogging()` 落盘路径上对 `toolUseResult.originalFile` 施加 **16KB** 上限，并写 `originalFileTruncated: true` / `originalFileBytes: <原长>` 让记录自证被裁。上限取 `TOOL_USE_RESULT_STRING_LIMIT`（16KB，`boundedSessionHistory.ts`）同一个数——客户端历来的预览就是这个界，故源侧裁剪不改变任何人可见的内容。只裁这一个字段：其它 `toolUseResult` 字段会被 recovery / 语义归约路径读回，必须保留原样。
- 验证：专项测试 `sessionStorage.originalFileBound.test.ts`（小结果不动、超限裁剪且标记正确、非字符串/非对象透传）与 `pipInstall` 合并跑 15/15 通过；改动文件 tsc 0 报错。存量数据一次性瘦身（前置全量备份 `/mnt/data1/claude-backup-20260927-023315/`）：`~/.claude/projects` 总量 3.1GB → **1.2GB（-61%）**；最大会话 359MB → 61MB、297MB → 7.5MB、261MB → 13MB、186MB → 17MB、119MB → 19MB。
