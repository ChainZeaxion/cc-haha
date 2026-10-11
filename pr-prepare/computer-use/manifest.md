# computer-use — Computer Use 解锁 Linux(X11) + 连接器平台

- PR 分支：`computer-use-linux`｜主题目录：`pr-prepare/computer-use/`
- 上游文档章节：十八/十六
- 单一真相源 patch 目录：`modify/patches/computer-use/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；40 文件 +2113−110）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `computer-use-connector-linux` | `computer-use-connector-linux-patch1.patch` | 16 | +21−11 | 4 |
| `computer-use-linux` | `computer-use-linux-patch1.patch` | 18,32,33 | +1473−81 | 31 |

## 文件清单（组补丁含 40 文件）

### 本主题优化项直接改动（35）

- `desktop/src/api/computerUse.ts`
- `desktop/src/components/computer-use/ComputerUseEnableDialog.tsx`
- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `desktop/src/pages/ComputerUseSettings.test.tsx`
- `desktop/src/pages/ComputerUseSettings.tsx`
- `runtime/linux_helper.py`
- `runtime/requirements-linux.txt`
- `src/server/__tests__/computer-use-api.test.ts`
- `src/server/api/computer-use.ts`
- `src/services/connectors/catalog.ts`
- `src/services/connectors/managedRuntime.ts`
- `src/services/connectors/remoteCatalog.ts`
- `src/services/connectors/skillCatalog.ts`
- `src/skills/bundled/computerUse.ts`
- `src/utils/computerUse/common.test.ts`
- `src/utils/computerUse/common.ts`
- `src/utils/computerUse/executor.ts`
- `src/utils/computerUse/gates.test.ts`
- `src/utils/computerUse/gates.ts`
- `src/utils/computerUse/pipInstall.test.ts`
- `src/utils/computerUse/pythonBridge.ts`
- `src/utils/computerUse/setup.test.ts`
- `src/utils/computerUse/skillGate.test.ts`
- `src/utils/computerUse/skillGate.ts`
- `src/vendor/computer-use-mcp/executor.ts`
- `src/vendor/computer-use-mcp/keyBlocklist.ts`
- `src/vendor/computer-use-mcp/mcpServer.ts`
- `src/vendor/computer-use-mcp/toolCalls.ts`
- `src/vendor/computer-use-mcp/tools.ts`
- `src/vendor/computer-use-mcp/windowsLegacyToolCalls.ts`
- `src/vendor/computer-use-mcp/windowsLegacyTools.ts`

### 依赖补齐（链内共享文件，取链终态；5）

- `desktop/src/api/h5Access.ts`
- `desktop/src/lib/desktopHost/browserHost.ts`
- `desktop/src/lib/desktopHost/terminalWs.ts`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/settings.ts`

### ⚠️ 上游 main 自基座也改过（7）

- `desktop/src/i18n/locales/en.ts`
- `desktop/src/i18n/locales/jp.ts`
- `desktop/src/i18n/locales/kr.ts`
- `desktop/src/i18n/locales/zh-TW.ts`
- `desktop/src/i18n/locales/zh.ts`
- `src/services/connectors/skillCatalog.ts`
- `src/vendor/computer-use-mcp/windowsLegacyToolCalls.ts`
