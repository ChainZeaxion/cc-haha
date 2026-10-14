# pr-prepare 索引（双层版：8 主题 / 34 优化项，对齐 `modify/patches/`）

> 目标：把本仓库的本地优化按**上游 PR 的功能域**拆成 8 组，独立向上游 `NanmiCoder/cc-haha` 提交 PR（head 分支 = `ChainZeaxion/cc-haha` 的 `pr/<slug>`）。
> **2026-10-03**：结构由「pr-N 目录 + 链位命名（64 项）」整体重构为**双层版**（`<主题>/<主题>-<优化项>`，34 项），与 `modify/patches/` **同构**；8 个 PR 已按本轮链终态**原地更新**。

## 结构（= `modify/patches/<主题>/` + PR 提交层）

```
pr-prepare/
  README.md            本文件
  00-overview.md       总览：主题→PR 表 + 链位→主题/优化项 权威映射
  VERIFICATION.md      拆分核验报告（含 tsc 口径坑）
  data.json / patch-meta.json   34 项元数据
  <主题>/              ← 与 modify/patches/<主题>/ 一一对应
    README.md          功能域概述 + 演进主线 + 优化项表
    manifest.md        项清单（patch/原链位/行数/文件数）+ 文件清单（直接改动/依赖补齐/上游冲突）
    00-group.patch     整主题组补丁（基座 068b3ebd → 该主题终态；提 PR 用）
    items/<主题>-<优化项>/README.md   单项说明（**引用** modify/patches 的 patch，不复制）
  archive/pr-by-chain-20261003/   旧结构（pr-N 目录 + 64 项链位命名）
```

**单一真相源**：patch 文件只在 `modify/patches/<主题>/`。**2026-10-14 起该目录合并为 15 个**（段一 8 个域 bundle，与本表 8 主题一一对应；段二 7 个独立项属 0.6.7 血缘、不在 PR 层），应用顺序见 `modify/patches/ORDER.md`；原 34 个单项 patch 归档于 `modify/archive/patches-merged-20261014/`（`patch-meta.json` 的 `patch_archived` 字段指向）。`pr-prepare/` 只放**说明 + 组补丁**，不复制 patch。

## 8 主题 / 34 优化项 / 8 PR

| 主题 | PR | 分支 | 项数 | 组文件 |
|---|---|---|---|---|
| `h5` | #1415 | `h5-remote-access` | 7 | 83 |
| `session` | #1411 | `session-related-optimizations` | 9 | 78 |
| `tps` | #1414 | `tps-indicator` | 4 | 74 |
| `usage` | #1412 | `usage-billing` | 3 | 26 |
| `test` | #1409 | `test-baseline` | 2 | 31 |
| `vcc` | #1410 | `vcc-compaction` | 4 | 58 |
| `computer-use` | #1416 | `computer-use-linux` | 2 | 40 |
| `thinking-subagent` | #1417 | `thinking-subagent` | 3 | 72 |

## 提 PR 用法

- **按主题整组提（推荐主粒度）**：干净基座 `068b3ebd` 上 `git apply pr-prepare/<主题>/00-group.patch`（8 组全部干净，并集 == 链终态 `56923871`）。
- **全链按序还原产品**：段一 8 个 bundle 按 `modify/patches/ORDER.md` apply（**终态逐字节 == 链终态**，2026-10-14 实测）；段二 7 个独立项在 0.6.7 血缘 `3a51ef84` 起另段 apply（同见 ORDER.md）。
- **按单项看/提**：`items/<主题>-<优化项>/README.md`（说明）+ `modify/archive/patches-merged-20261014/<主题>/`（已归档单项 patch）。

## 分组依据

主题 = 上游 PR 的 8 个功能域（`h5` / `session` / `tps` / `usage` / `test` / `vcc` / `computer-use` / `thinking-subagent`）。
「优化项」= 可独立成 PR 的最小功能单元（拆不开才 `patch2/3`）；一个优化项常合并链内相邻的若干链位（见 `00-overview.md` 第二节）。
