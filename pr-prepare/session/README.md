# session — 会话及相关优化（会话基础 + 文件下载 + 大会话加载/传输性能 + 打开提速）

> PR 分支：`session-related-optimizations`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/session/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `session-export` | `session-export-patch1.patch` | 3 | +493−38 | 5 |
| `session-refresh` | `session-refresh-patch1.patch` | 6 | +183−7 | 2 |
| `session-file-download` | `session-file-download-patch1.patch` | 8,45,51,53 | +644−44 | 15 |
| `session-disable-updates` | `session-disable-updates-patch1.patch` | 9 | +145−1 | 4 |
| `session-thinking-switch` | `session-thinking-switch-patch1.patch` | 11 | +349−7 | 11 |
| `session-gzip-transport` | `session-gzip-transport-patch1.patch` | 20,25 | +415−1 | 3 |
| `session-history-transport` | `session-history-transport-patch1.patch` | 23,24,26,31 | +363−16 | 9 |
| `session-baseline-typecheck` | `session-baseline-typecheck-patch1.patch` | 27 | +7−4 | 2 |
| `session-open-speed` | `session-open-speed-patch1.patch` | 55,56,57 | +526−22 | 6 |

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（9 项）：
- `items/session-export/README.md`
- `items/session-refresh/README.md`
- `items/session-file-download/README.md`
- `items/session-disable-updates/README.md`
- `items/session-thinking-switch/README.md`
- `items/session-gzip-transport/README.md`
- `items/session-history-transport/README.md`
- `items/session-baseline-typecheck/README.md`
- `items/session-open-speed/README.md`
