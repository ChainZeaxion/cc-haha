# test — 测试环境隔离与基线修复

> PR 分支：`test-baseline`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/test/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `test-server-test-baseline` | `test-server-test-baseline-patch1.patch` | 12,47 | +115−16 | 10 |
| `test-chapter-27-tests` | `test-chapter-27-tests-patch1.patch` | 58,60 | +180−28 | 18 |

## 功能域概述

0.6.6 基座上 `src/server` 存在 22 条与本仓优化无关的既有测试失败，且桌面 dev 环境会把一批 `CLAUDE_CODE_*` 环境变量（如 `CLAUDE_CODE_MODEL_CONTEXT_WINDOWS`、`CLAUDE_CODE_ATTRIBUTION_HEADER=0`）导出进测试进程——同一批用例**单跑失败、官方 runner 全绿**，是环境泄漏而非真缺陷。本组把这些基线失败全部清零、建立「零失败」测试基线，并提供统一的模型 env 隔离工具（`isolateModelDefaultsEnv()`），使后续任何回归都能被立刻发现、单跑与官方 runner 结论一致。

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（2 项）：
- `items/test-server-test-baseline/README.md`
- `items/test-chapter-27-tests/README.md`
