# vcc — vcc 算法压缩

> PR 分支：`vcc-compaction`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/vcc/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `vcc-compactor` | `vcc-compactor-patch1.patch` | 14,40 | +5794−35 | 48 |
| `vcc-autocompact-window-tiers` | `vcc-autocompact-window-tiers-patch1.patch` | 22 | +144−26 | 2 |
| `vcc-compact-dead-import` | `vcc-compact-dead-import-patch1.patch` | 36 | +1−3 | 3 |
| `vcc-calibration-scripts` | `vcc-calibration-scripts-patch1.patch` | 59 | +1518−0 | 3 |

## 功能域概述

本组把 [pi-vcc](https://github.com/sting8k/pi-vcc)（"Algorithmic conversation compactor — transcript-preserving structured summaries, no LLM calls"，0.8.0）完整移植进 cc-haha：用**纯算法**（零 LLM 调用）替代现有 `/compact` 与 auto-compact 的 LLM 摘要路径，编译出 5 个语义 section + brief transcript，被压缩的原始细节依赖既有 session JSONL 持久化、由新增 `vcc_recall` 工具按全局 message index（`#N`）无损检索回读。配套提供：压缩阈值按上下文窗口分档（软触发百分比 + 硬触发绝对下限）、vcc 失败时回落既有 LLM 摘要路径的降级兜底，以及 vcc 片段模式的语料校准 / 引擎判分脚本。默认后端为 algorithm，设置中可切换、运行中可热切换。

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（4 项）：
- `items/vcc-compactor/README.md`
- `items/vcc-autocompact-window-tiers/README.md`
- `items/vcc-compact-dead-import/README.md`
- `items/vcc-calibration-scripts/README.md`
