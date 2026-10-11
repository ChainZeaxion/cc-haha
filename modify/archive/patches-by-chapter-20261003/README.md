# 优化项 patch 组（按优化项分组，组内合并为单个 patch）

**应用顺序 = 下表自上而下**（每个目录一个 `<组名>.patch`）：

```
cd <repo>
for d in $(sed -n 's/^| [0-9]* | `\([^`]*\)` |.*/\1/p' ORDER.md); do
  git apply -p1 modify/patches/$d/$d.patch
done
```

| # | 组（目录） | 原链位 | 原补丁数 |
|---|---|---|---|
| 1 | `h5-access-token` | — | 3 |
| 2 | `session-export` | — | 1 |
| 3 | `h5-settings-parity` | — | 1 |
| 4 | `session-refresh` | — | 1 |
| 5 | `tps-indicator` | — | 9 |
| 6 | `file-download` | — | 7 |
| 7 | `disable-updates` | — | 1 |
| 8 | `cache-billing` | — | 1 |
| 9 | `thinking-switch` | — | 1 |
| 10 | `server-test-baseline` | — | 2 |
| 11 | `h5-mobile-quick-actions` | — | 1 |
| 12 | `vcc-compactor` | — | 2 |
| 13 | `h5-mobile-scheduled` | — | 1 |
| 14 | `connector-linux` | — | 1 |
| 15 | `h5-mobile-market-layout` | — | 1 |
| 16 | `computer-use-linux` | — | 3 |
| 17 | `context-usage-anchor` | — | 1 |
| 18 | `h5-gzip-transport` | — | 1 |
| 19 | `thinking-tool-timing` | — | 8 |
| 20 | `autocompact-window-tiers` | — | 1 |
| 21 | `history-transport-bounds` | — | 5 |
| 22 | `baseline-typecheck` | — | 2 |
| 23 | `h5-mobile-run-records` | — | 1 |
| 24 | `local-index-multi-root` | — | 2 |
| 25 | `split-no-double-count` | — | 1 |
| 26 | `chapter-27-misc` | — | 3 |
| 27 | `tps-engine-rewrite` | — | 5 |
| 28 | `tps-density-estimation` | — | 1 |

> 原 67 个平铺补丁已归档于 `modify/archive/patches-flat-20261003/`（可回溯）。
> 分组只改变**组织方式与顺序**：终态文件树与分组前**逐字节一致**（已实测 28/28 应用成功、tree 相同）。
