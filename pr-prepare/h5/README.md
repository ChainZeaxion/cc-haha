# h5 — H5 远程访问与移动端支持

> PR 分支：`h5-remote-access`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/h5/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `h5-access-token` | `h5-access-token-patch1.patch` | 1,2,5 | +2480−144 | 34 |
| `h5-settings-parity` | `h5-settings-parity-patch1.patch` | 4 | +212−134 | 4 |
| `h5-mobile-quick-actions` | `h5-mobile-quick-actions-patch1.patch` | 13 | +251−0 | 3 |
| `h5-mobile-scheduled` | `h5-mobile-scheduled-patch1.patch` | 15 | +4−3 | 2 |
| `h5-mobile-market-layout` | `h5-mobile-market-layout-patch1.patch` | 17 | +1−1 | 1 |
| `h5-mobile-run-records` | `h5-mobile-run-records-patch1.patch` | 34 | +52−1 | 2 |
| `h5-local-index-multi-root` | `h5-local-index-multi-root-patch1.patch` | 46,48 | +292−121 | 4 |

## 功能域概述

让手机浏览器（H5）通过局域网/公网访问 cc-haha 时获得接近桌面端的能力：H5 访问令牌开关与私网免令牌、H5 设置页与桌面端全 tab 对齐、H5 终端桥接（真实 PTY 走 WebSocket）、移动端悬浮快捷入口（任务列表/终端/文件浏览/审查），以及移动端可打开技能市场、计划任务、子代理运行记录等页面。另含本地 dev 实例的额外索引根（`CC_HAHA_EXTRA_PROJECT_ROOTS`）与会话列表多根校验，保证 dev/H5 场景下真实项目的会话能被完整索引和列出。

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（7 项）：
- `items/h5-access-token/README.md`
- `items/h5-settings-parity/README.md`
- `items/h5-mobile-quick-actions/README.md`
- `items/h5-mobile-scheduled/README.md`
- `items/h5-mobile-market-layout/README.md`
- `items/h5-mobile-run-records/README.md`
- `items/h5-local-index-multi-root/README.md`
