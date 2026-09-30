# pr-7 — vcc 算法压缩（pi-vcc 移植 + 窗口分档 + 降级兜底 + 校准脚本）

- 上游文档章节：十三/二十四/二十七.2
- 建议分支：`pr/vcc-compaction`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 14 | `items/14-vcc-compactor/14-vcc-compactor.patch` | +5584/−32 | 47 | 十三 pi-vcc 算法压缩移植 + 双后端热切换 + vcc_recall |
| 22 | `items/22-autocompact-window-tiers/22-autocompact-window-tiers.patch` | +144/−26 | 2 | 二十四 上下文压缩阈值按窗口分档（软触发百分比 + 硬触发绝对下限） |
| 36 | `items/36-compact-dead-import-cleanup/36-compact-dead-import-cleanup.patch` | +1/−3 | 3 | 策略门禁 `check:policy` 的 **dead-imports 清零**（十三章 vcc 移植遗留的 3 处未引用导入；该规则口径是「删」而非白名单） |
| 40 | `items/40-vcc-compact-fallback/40-vcc-compact-fallback.patch` | +217/−10 | 2 | 十三 vcc 失败降级兜底（抛错/空摘要 → 回落既有 LLM 摘要路径，避免自动压缩熔断静默停摆） |
| 59 | `items/59-chapter-27-vcc-calibration-scripts/59-chapter-27-vcc-calibration-scripts.patch` | +1518/−0 | 3 | 二十七 27.2：**vcc 片段模式校准/判分脚本**——`scripts/vcc-slice-calibration.ts`(1076 行) + `scripts/vcc-slice-judge.ts`(439 行)，随「局部压缩接入  |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「十三」：自第 1093 行起
- 章节「二十四」：自第 2139 行起
- 章节「二十七」：自第 2363 行起

## 文件清单

- `.gitignore` （本组 patch 直接改动）
- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/desktopRuntime.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/settings/GeneralSettings.compaction.test.tsx` （本组 patch 直接改动）
- `desktop/src/pages/settings/GeneralSettings.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `scripts/vcc-slice-calibration.ts` （本组 patch 直接改动）
- `scripts/vcc-slice-judge.ts` （本组 patch 直接改动）
- `src/services/compact/autoCompact.test.ts` （本组 patch 直接改动）
- `src/services/compact/autoCompact.ts` （本组 patch 直接改动）
- `src/services/compact/compact.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/services/compact/compact.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/services/compact/vcc/adapter.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/ccGlobalIndex.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/engine.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/pi-ai.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/recallDrillDown.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/recallLoader.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vccCompact.test.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vccCompact.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/brief.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/build-sections.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/compact-args.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/content.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/drill-down.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/filter-noise.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/format-recall.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/format.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/global-indices.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/jsonl.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/lineage.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/load-messages.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/normalize.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/rank.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/recall-scope.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/render-entries.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/report.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/sanitize.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/search-entries.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/settings.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/skill-collapse.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/summarize.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/token-estimate.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/core/tool-args.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/details.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/extract/commits.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/extract/files.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/extract/goals.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/extract/preferences.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/sections.ts` （本组 patch 直接改动）
- `src/services/compact/vcc/vendor/types.ts` （本组 patch 直接改动）
- `src/tools.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/tools/VccRecallTool/UI.tsx` （本组 patch 直接改动）
- `src/tools/VccRecallTool/VccRecallTool.test.ts` （本组 patch 直接改动）
- `src/tools/VccRecallTool/VccRecallTool.ts` （本组 patch 直接改动）
- `src/tools/VccRecallTool/prompt.ts` （本组 patch 直接改动）
- `src/utils/compactionBackend.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
