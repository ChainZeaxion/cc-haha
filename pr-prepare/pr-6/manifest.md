# pr-6 — 测试环境隔离与基线修复（含章内残余 hunk）

- 上游文档章节：十二/二十七.1/二十七.3
- 建议分支：`pr/test-baseline`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 12 | `items/12-server-test-baseline-zeroing/12-server-test-baseline-zeroing.patch` | +95/−16 | 7 | 十二 src/server 既有 22 条测试失败清零 |
| 47 | `items/47-test-model-env-isolation/47-test-model-env-isolation.patch` | +20/−0 | 3 | 十二 补记：三处模型 env 敏感用例接入 `isolateModelDefaultsEnv`——本机导出的 `CLAUDE_CODE_MODEL_CONTEXT_WINDOWS` 等泄漏致 `modelContextWindows`/`u |
| 58 | `items/58-chapter-27-test-env-isolation/58-chapter-27-test-env-isolation.patch` | +147/−22 | 13 | 二十七 27.1：**测试环境隔离与遗留失败清零**——新增 `src/testUtils/modelEnv.ts`（`isolateModelDefaultsEnv()` 存/剥离/还原模型相关 env），并接入 12 个用例（模型 4  |
| 60 | `items/60-chapter-27-residual-hunks/60-chapter-27-residual-hunks.patch` | +33/−6 | 5 | 二十七 27.3：**章内残余 hunk**——`api/claude.ts` bound-thinking 模型（Fable 5.1）需回放思考块（`modelUsesBoundThinking`，剥离会破坏 system 变更后的重放） |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「十二」：自第 1093 行起
- 章节「二十七」：自第 2363 行起

## 文件清单

- `adapters/whatsapp/session.ts` （本组 patch 直接改动）
- `desktop/package.json` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/providerModels.ts` （本组 patch 直接改动）
- `desktop/src/pages/TerminalSettings.tsx` （本组 patch 直接改动）
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `src/cli/print.sessionMessage.test.ts` （本组 patch 直接改动）
- `src/constants/system.test.ts` （本组 patch 直接改动）
- `src/entrypoints/sdk/coreSchemas.modelInfo.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/conversation-service.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/__tests__/e2e/full-flow.test.ts` （本组 patch 直接改动）
- `src/server/services/connectorService.ts` （本组 patch 直接改动）
- `src/server/services/sessionCollaborationService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/workspaceService.ts` （本组 patch 直接改动）
- `src/server/services/workspaceWatch.test.ts` （本组 patch 直接改动）
- `src/services/api/claude.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/services/api/client.test.ts` （本组 patch 直接改动）
- `src/skills/bundled/computerUse.test.ts` （本组 patch 直接改动）
- `src/testUtils/modelEnv.ts` （本组 patch 直接改动）
- `src/tools/AgentTool/builtInAgentOverrides.test.ts` （本组 patch 直接改动）
- `src/utils/__tests__/thinking.test.ts` （本组 patch 直接改动）
- `src/utils/effort.agent.test.ts` （本组 patch 直接改动）
- `src/utils/model/agent.test.ts` （本组 patch 直接改动）
- `src/utils/model/fable.test.ts` （本组 patch 直接改动）
- `src/utils/model/modelContextWindows.test.ts` （本组 patch 直接改动）
- `src/utils/model/opus5.test.ts` （本组 patch 直接改动）
- `src/utils/model/opus55.test.ts` （本组 patch 直接改动）
- `src/utils/permissions/PermissionUpdate.ts` （本组 patch 直接改动）
- `src/utils/processUserInput/processSlashCommand.test.ts` （本组 patch 直接改动）
- `src/utils/workflows/ultracode.test.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
