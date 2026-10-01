# pr-8 — Computer Use 解锁 Linux(X11) + 连接器平台支持

- 上游文档章节：十八/十六
- 建议分支：`pr/computer-use-linux`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 16 | `items/16-connector-linux-platform/16-connector-linux-platform.patch` | +21/−11 | 4 | 十六 连接器目录 Linux 平台支持（x64/arm64） |
| 18 | `items/18-computer-use-linux-x11/18-computer-use-linux-x11.patch` | +1231/−75 | 24 | 十八 Computer Use 解锁 Linux（X11） |
| 32 | `items/32-computer-use-platform-components/32-computer-use-platform-components.patch` | +186/−9 | 2 | 十八 平台化组件选择：`pythonRuntimeFor()` 显式平台表（macOS/未知平台无 Python 组件），修复「二元三目」把 win 依赖清单发给 mac |
| 33 | `items/33-computer-use-python-path-fallback/33-computer-use-python-path-fallback.patch` | +62/−3 | 7 | 十八 无原生文件选择器时**回退填入已探测解释器路径**（+ 5 语言 i18n 键 + 测试） |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「十八」：自第 1356 行起
- 章节「十六」：自第 1308 行起

## 文件清单

- `desktop/src/api/computerUse.ts` （本组 patch 直接改动）
- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/computer-use/ComputerUseEnableDialog.tsx` （本组 patch 直接改动）
- `desktop/src/i18n/locales/en.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/jp.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/kr.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh-TW.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/lib/desktopHost/browserHost.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/desktopHost/terminalWs.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/ComputerUseSettings.test.tsx` （本组 patch 直接改动）
- `desktop/src/pages/ComputerUseSettings.tsx` （本组 patch 直接改动）
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `runtime/linux_helper.py` （本组 patch 直接改动）
- `runtime/requirements-linux.txt` （本组 patch 直接改动）
- `src/server/__tests__/computer-use-api.test.ts` （本组 patch 直接改动）
- `src/server/api/computer-use.ts` （本组 patch 直接改动）
- `src/services/connectors/catalog.ts` （本组 patch 直接改动）
- `src/services/connectors/managedRuntime.ts` （本组 patch 直接改动）
- `src/services/connectors/remoteCatalog.ts` （本组 patch 直接改动）
- `src/services/connectors/skillCatalog.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/skills/bundled/computerUse.ts` （本组 patch 直接改动）
- `src/utils/computerUse/common.test.ts` （本组 patch 直接改动）
- `src/utils/computerUse/common.ts` （本组 patch 直接改动）
- `src/utils/computerUse/executor.ts` （本组 patch 直接改动）
- `src/utils/computerUse/gates.test.ts` （本组 patch 直接改动）
- `src/utils/computerUse/gates.ts` （本组 patch 直接改动）
- `src/utils/computerUse/pipInstall.test.ts` （本组 patch 直接改动）
- `src/utils/computerUse/pythonBridge.ts` （本组 patch 直接改动）
- `src/utils/computerUse/setup.test.ts` （本组 patch 直接改动）
- `src/utils/computerUse/skillGate.test.ts` （本组 patch 直接改动）
- `src/utils/computerUse/skillGate.ts` （本组 patch 直接改动）
- `src/vendor/computer-use-mcp/executor.ts` （本组 patch 直接改动）
- `src/vendor/computer-use-mcp/keyBlocklist.ts` （本组 patch 直接改动）
- `src/vendor/computer-use-mcp/mcpServer.ts` （本组 patch 直接改动）
- `src/vendor/computer-use-mcp/toolCalls.ts` （本组 patch 直接改动）
- `src/vendor/computer-use-mcp/tools.ts` （本组 patch 直接改动）
- `src/vendor/computer-use-mcp/windowsLegacyToolCalls.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/vendor/computer-use-mcp/windowsLegacyTools.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
