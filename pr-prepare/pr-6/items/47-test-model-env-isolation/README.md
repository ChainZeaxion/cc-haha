# 47-test-model-env-isolation — 三处模型 env 敏感用例接入 `isolateModelDefaultsEnv`（链位 47，`47-test-model-env-isolation.patch`，3 文件 +20/−0）

> 功能组：pr-6 — 测试环境隔离与基线修复（pr-prepare/pr-6/）
> 链位 47，patch `47-test-model-env-isolation.patch`（本目录）

- **需求背景**：十二章清零后仍有补记：本机 dev 导出的 `CLAUDE_CODE_MODEL_CONTEXT_WINDOWS` 等变量泄漏进 `modelContextWindows`/`ultracode`/`processSlashCommand` 三组用例，**单跑也失败**；官方 runner 因逐文件独立进程 + env 白名单而免疫，两边结论不一致。
- **方案**：将 `modelContextWindows.test.ts`、`ultracode.test.ts`、`processSlashCommand.test.ts` 三处模型 env 敏感用例接入 `isolateModelDefaultsEnv()`（在 `beforeEach` 中保存/剥离/还原模型相关 env），消除宿主环境对这些用例的影响。
- **验证**：三组用例在带 `CLAUDE_CODE_MODEL_CONTEXT_WINDOWS` 等导出的 dev shell 下单跑全绿，与官方 runner 结论一致（3 文件 20 行新增，纯测试侧改动）。
