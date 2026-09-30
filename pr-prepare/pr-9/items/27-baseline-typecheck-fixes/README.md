# 27-baseline-typecheck-fixes — 基线真缺陷修复：typecheck（链位 27，`27-baseline-typecheck-fixes.patch`）

> 功能组：pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）（pr-prepare/pr-9/）
> 链位 27，patch `27-baseline-typecheck-fixes.patch`（本目录）

- 需求背景：全量验证时发现两处 tsc 基线错误需修复以让本组改动文件「0 新增错误」的口径成立：`src/server/index.ts` 的 TS2502（参数遮蔽致类型自引用，经暂存法核验为既有基线：HEAD 在 281 行，加 36 行后位移至 317）与 vendor 重复导入 TS2300。
- 方案：修复 `src/server/index.ts` 的 TS2502 参数遮蔽（类型自引用）与 `src/vendor/computer-use-mcp` 的重复导入 TS2300（+7/−4，2 文件）。
- 验证：本组 patch 应用后改动文件 tsc 0 新增错误；`src/server` 全量测试保持全绿（见组级验证口径）。
