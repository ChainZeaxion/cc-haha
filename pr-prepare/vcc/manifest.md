# vcc — vcc 算法压缩

- PR 分支：`vcc-compaction`｜主题目录：`pr-prepare/vcc/`
- 上游文档章节：十三/二十四/二十七.2
- 单一真相源 patch 目录：`modify/patches/vcc/`（应用顺序见 `modify/patches/ORDER.md`）
- **组补丁（提 PR 用）**：`00-group.patch`（基座 `068b3ebd` → 本主题终态；58 文件 +7650−61）

## 优化项与 patch（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `vcc-compactor` | `vcc-compactor-patch1.patch` | 14,40 | +5794−35 | 48 |
| `vcc-autocompact-window-tiers` | `vcc-autocompact-window-tiers-patch1.patch` | 22 | +144−26 | 2 |
| `vcc-compact-dead-import` | `vcc-compact-dead-import-patch1.patch` | 36 | +1−3 | 3 |
| `vcc-calibration-scripts` | `vcc-calibration-scripts-patch1.patch` | 59 | +1518−0 | 3 |

## 文件清单（组补丁含 58 文件）

### 本主题优化项直接改动（53）

- `.gitignore`
- `desktop/src/pages/settings/GeneralSettings.compaction.test.tsx`
- `scripts/vcc-slice-calibration.ts`
- `scripts/vcc-slice-judge.ts`
- `src/services/compact/autoCompact.test.ts`
- `src/services/compact/autoCompact.ts`
- `src/services/compact/compact.test.ts`
- `src/services/compact/compact.ts`
- `src/services/compact/vcc/adapter.ts`
- `src/services/compact/vcc/ccGlobalIndex.ts`
- `src/services/compact/vcc/engine.ts`
- `src/services/compact/vcc/pi-ai.ts`
- `src/services/compact/vcc/recallDrillDown.ts`
- `src/services/compact/vcc/recallLoader.ts`
- `src/services/compact/vcc/vccCompact.test.ts`
- `src/services/compact/vcc/vccCompact.ts`
- `src/services/compact/vcc/vendor/core/brief.ts`
- `src/services/compact/vcc/vendor/core/build-sections.ts`
- `src/services/compact/vcc/vendor/core/compact-args.ts`
- `src/services/compact/vcc/vendor/core/content.ts`
- `src/services/compact/vcc/vendor/core/drill-down.ts`
- `src/services/compact/vcc/vendor/core/filter-noise.ts`
- `src/services/compact/vcc/vendor/core/format-recall.ts`
- `src/services/compact/vcc/vendor/core/format.ts`
- `src/services/compact/vcc/vendor/core/global-indices.ts`
- `src/services/compact/vcc/vendor/core/jsonl.ts`
- `src/services/compact/vcc/vendor/core/lineage.ts`
- `src/services/compact/vcc/vendor/core/load-messages.ts`
- `src/services/compact/vcc/vendor/core/normalize.ts`
- `src/services/compact/vcc/vendor/core/rank.ts`
- `src/services/compact/vcc/vendor/core/recall-scope.ts`
- `src/services/compact/vcc/vendor/core/render-entries.ts`
- `src/services/compact/vcc/vendor/core/report.ts`
- `src/services/compact/vcc/vendor/core/sanitize.ts`
- `src/services/compact/vcc/vendor/core/search-entries.ts`
- `src/services/compact/vcc/vendor/core/settings.ts`
- `src/services/compact/vcc/vendor/core/skill-collapse.ts`
- `src/services/compact/vcc/vendor/core/summarize.ts`
- `src/services/compact/vcc/vendor/core/token-estimate.ts`
- `src/services/compact/vcc/vendor/core/tool-args.ts`
- `src/services/compact/vcc/vendor/details.ts`
- `src/services/compact/vcc/vendor/extract/commits.ts`
- `src/services/compact/vcc/vendor/extract/files.ts`
- `src/services/compact/vcc/vendor/extract/goals.ts`
- `src/services/compact/vcc/vendor/extract/preferences.ts`
- `src/services/compact/vcc/vendor/sections.ts`
- `src/services/compact/vcc/vendor/types.ts`
- `src/tools.ts`
- `src/tools/VccRecallTool/UI.tsx`
- `src/tools/VccRecallTool/VccRecallTool.test.ts`
- `src/tools/VccRecallTool/VccRecallTool.ts`
- `src/tools/VccRecallTool/prompt.ts`
- `src/utils/compactionBackend.ts`

### 依赖补齐（链内共享文件，取链终态；5）

- `desktop/src/api/h5Access.ts`
- `desktop/src/lib/desktopRuntime.ts`
- `desktop/src/pages/settings/GeneralSettings.tsx`
- `desktop/src/stores/settingsStore.ts`
- `desktop/src/types/settings.ts`

### ⚠️ 上游 main 自基座也改过（3）

- `src/services/compact/compact.test.ts`
- `src/services/compact/compact.ts`
- `src/tools.ts`
