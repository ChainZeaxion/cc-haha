# session-baseline-typecheck — 基线类型检查修复（原链位 27）

> 功能主题：`session` — 会话及相关优化（会话基础 + 文件下载 + 大会话加载/传输性能 + 打开提速）（`pr-prepare/session/`）｜ PR 分支 `session-related-optimizations`
> **单一真相源 patch**：`modify/patches/session/session-baseline-typecheck-patch1.patch`（2 文件 +7−4）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 27 | `baseline-typecheck-fixes` | 基线真缺陷修复：`index.ts` TS2502（参数遮蔽致类型自引用）+ vendor 重复导入 TS2300 |

## 明细

### 原链位 27 — `baseline-typecheck-fixes`

- 需求背景：全量验证时发现两处 tsc 基线错误需修复以让本组改动文件「0 新增错误」的口径成立：`src/server/index.ts` 的 TS2502（参数遮蔽致类型自引用，经暂存法核验为既有基线：HEAD 在 281 行，加 36 行后位移至 317）与 vendor 重复导入 TS2300。
- 方案：修复 `src/server/index.ts` 的 TS2502 参数遮蔽（类型自引用）与 `src/vendor/computer-use-mcp` 的重复导入 TS2300（+7/−4，2 文件）。
- 验证：本组 patch 应用后改动文件 tsc 0 新增错误；`src/server` 全量测试保持全绿（见组级验证口径）。
