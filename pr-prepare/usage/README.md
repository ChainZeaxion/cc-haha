# usage — 上下文缓存计费与用量聚合显示

> PR 分支：`usage-billing`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/usage/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `usage-cache-billing` | `usage-cache-billing-patch1.patch` | 10 | +311−30 | 7 |
| `usage-context-usage-anchor` | `usage-context-usage-anchor-patch1.patch` | 19 | +74−12 | 4 |
| `usage-session-speed-usage-pairing` | `usage-session-speed-usage-pairing-patch1.patch` | 37 | +375−41 | 11 |

## 功能域概述

本组统一修正 cc-haha 中「上下文用量 / 缓存命中 / 会话费用 / 生成速度」类读数的口径问题：把缓存命中率从被历史轮稀释的会话累计口径改为请求级最新轮口径并新增会话费用双币显示；把 context usage 显示总量从「自 compact_boundary 全量 rough 累加」改为与 auto-compact 同口径的 usage 锚（治 bc 中间件压缩后百分比不收敛）；把面板「生成速度」的分子分母改为配对口径并修复 transcript usage 去重丢 output。三项均围绕「显示的数字要等于真实测量」，不触碰压缩触发等逻辑路径。

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（3 项）：
- `items/usage-cache-billing/README.md`
- `items/usage-context-usage-anchor/README.md`
- `items/usage-session-speed-usage-pairing/README.md`
