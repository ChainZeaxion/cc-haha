# pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 传输）

- 上游文档章节：二十二/二十
- 建议分支：`pr/large-session-perf`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 20 | `items/20-h5-gzip-transport/20-h5-gzip-transport.patch` | +246/−1 | 3 | 二十 H5 远端 API 响应 gzip 压缩传输 |
| 23 | `items/23-history-transport-bounds/23-history-transport-bounds.patch` | +101/−7 | 3 | 二十二 历史传输裁剪（`toolUseResult` 有界投影）+ 读取预算收紧 |
| 24 | `items/24-file-history-dedup/24-file-history-dedup.patch` | +83/−5 | 2 | 二十二 E file-history `-completed-*` 重复消除（变动才建） |
| 25 | `items/25-gzip-transport/25-gzip-transport.patch` | +175/−5 | 3 | 二十二 G gzip 传输改造：同步→异步（移出事件循环）+ 会话大小门控（<10MB 不压缩） |
| 26 | `items/26-history-first-paint-bound/26-history-first-paint-bound.patch` | +61/−3 | 2 | 二十二 B 首屏翻页上限（提前返回并保留 `nextCursor`，打通既有「加载更早」） |
| 27 | `items/27-baseline-typecheck-fixes/27-baseline-typecheck-fixes.patch` | +7/−4 | 2 | 基线真缺陷修复：`index.ts` TS2502（参数遮蔽致类型自引用）+ vendor 重复导入 TS2300 |
| 31 | `items/31-storage-original-file-bound/31-storage-original-file-bound.patch` | +118/−1 | 2 | 二十二 F **存量瘦身**：写入侧对 `toolUseResult.originalFile` 做 16KB 有界裁剪（+ `originalFileTruncated/Bytes` 标记，含新测试文件） |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「二十二」：自第 1901 行起
- 章节「二十」：自第 1512 行起

## 文件清单

- `desktop/src/api/sessions.test.ts` （本组 patch 直接改动）
- `desktop/src/api/sessions.ts` （本组 patch 直接改动）
- `desktop/src/types/chat.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/types/session.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `src/server/index.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/responseCompression.test.ts` （本组 patch 直接改动）
- `src/server/responseCompression.ts` （本组 patch 直接改动）
- `src/server/services/boundedSessionHistory.test.ts` （本组 patch 直接改动）
- `src/server/services/boundedSessionHistory.ts` （本组 patch 直接改动）
- `src/server/services/sessionService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/utils/fileHistory.security.test.ts` （本组 patch 直接改动）
- `src/utils/fileHistory.ts` （本组 patch 直接改动）
- `src/utils/sessionStorage.originalFileBound.test.ts` （本组 patch 直接改动）
- `src/utils/sessionStorage.ts` （本组 patch 直接改动）
- `src/vendor/computer-use-mcp/toolCalls.test.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
