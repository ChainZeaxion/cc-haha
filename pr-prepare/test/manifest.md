# test — 测试环境隔离与基线修复

- PR 分支：`test-baseline`｜主题目录：`pr-prepare/test/`
- 上游文档章节：十二/二十七.1/二十七.3
- 单一真相源 patch 目录：`modify/patches/test/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；31 文件 +461−45）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `test-server-test-baseline` | `test-server-test-baseline-patch1.patch` | 12,47 | +115−16 | 10 |
| `test-chapter-27-tests` | `test-chapter-27-tests-patch1.patch` | 58,60 | +180−28 | 18 |

## 文件清单（组补丁含 31 文件）

### 本主题优化项直接改动（28）

- `adapters/whatsapp/session.ts`
- `desktop/package.json`
- `desktop/src/lib/providerModels.ts`
- `desktop/src/pages/TerminalSettings.tsx`
- `src/cli/print.sessionMessage.test.ts`
- `src/constants/system.test.ts`
- `src/entrypoints/sdk/coreSchemas.modelInfo.test.ts`
- `src/server/__tests__/conversation-service.test.ts`
- `src/server/__tests__/e2e/full-flow.test.ts`
- `src/server/services/connectorService.ts`
- `src/server/services/sessionCollaborationService.ts`
- `src/server/services/workspaceService.ts`
- `src/server/services/workspaceWatch.test.ts`
- `src/services/api/claude.ts`
- `src/services/api/client.test.ts`
- `src/skills/bundled/computerUse.test.ts`
- `src/testUtils/modelEnv.ts`
- `src/tools/AgentTool/builtInAgentOverrides.test.ts`
- `src/utils/__tests__/thinking.test.ts`
- `src/utils/effort.agent.test.ts`
- `src/utils/model/agent.test.ts`
- `src/utils/model/fable.test.ts`
- `src/utils/model/modelContextWindows.test.ts`
- `src/utils/model/opus5.test.ts`
- `src/utils/model/opus55.test.ts`
- `src/utils/permissions/PermissionUpdate.ts`
- `src/utils/processUserInput/processSlashCommand.test.ts`
- `src/utils/workflows/ultracode.test.ts`

### 依赖补齐（链内共享文件，取链终态；3）

- `desktop/src/api/h5Access.ts`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/settings.ts`

### ⚠️ 上游 main 自基座也改过（9）

- `desktop/package.json`
- `src/server/__tests__/conversation-service.test.ts`
- `src/server/__tests__/e2e/full-flow.test.ts`
- `src/server/services/sessionCollaborationService.ts`
- `src/server/services/workspaceService.ts`
- `src/services/api/claude.ts`
- `src/utils/model/fable.test.ts`
- `src/utils/model/opus5.test.ts`
- `src/utils/permissions/PermissionUpdate.ts`
