# modify/patches —— 按 PR 主题两层分组

结构：`patches/<主题>/<主题>-<优化项>-patch<N>.patch`（一个优化项一个 patch；拆不开才 patch2/3）。

**应用顺序 = `ORDER.md` 自上而下**（34 个 patch；项按最小链位排序，见下）。

```bash
while read -r p; do git apply -p1 "$p"; done < modify/patches/ORDER.md
```

## h5/ — H5 远程访问与移动端支持（pr-1）

| 优化项 patch | 原链位 |
|---|---|
| `h5-access-token-patch1.patch` | 1,1,2,5 |
| `h5-settings-parity-patch1.patch` | 4,4 |
| `h5-mobile-quick-actions-patch1.patch` | 13,13 |
| `h5-mobile-scheduled-patch1.patch` | 15,15 |
| `h5-mobile-market-layout-patch1.patch` | 17,17 |
| `h5-mobile-run-records-patch1.patch` | 34,34 |
| `h5-local-index-multi-root-patch1.patch` | 46,46,48 |

## session/ — 会话及相关优化（pr-2，含文件下载/大会话性能）

| 优化项 patch | 原链位 |
|---|---|
| `session-export-patch1.patch` | 3,3 |
| `session-refresh-patch1.patch` | 6,6 |
| `session-file-download-patch1.patch` | 8,8,45,51,53 |
| `session-disable-updates-patch1.patch` | 9,9 |
| `session-thinking-switch-patch1.patch` | 11,11 |
| `session-gzip-transport-patch1.patch` | 20,20,25 |
| `session-history-transport-patch1.patch` | 23,23,24,26,31 |
| `session-baseline-typecheck-patch1.patch` | 27,27 |
| `session-open-speed-patch1.patch` | 55,55,56,57 |

## tps/ — TPS 实时解码速度指示器（pr-3）

| 优化项 patch | 原链位 |
|---|---|
| `tps-indicator-patch1.patch` | 7,7,30,35,38,42,44,50,54 |
| `tps-engine-rewrite-patch1.patch` | 62,62,64,65,67 |
| `tps-density-estimation-patch1.patch` | 66,66 |
| `tps-session-total-patch1.patch` | 2026-10-03 新增（会话读数=会话总量，去子代理重复计） |

## usage/ — 上下文缓存计费与用量聚合显示（pr-5）

| 优化项 patch | 原链位 |
|---|---|
| `usage-cache-billing-patch1.patch` | 10,10 |
| `usage-context-usage-anchor-patch1.patch` | 19,19 |
| `usage-session-speed-usage-pairing-patch1.patch` | 37,37 |

## test/ — 测试环境隔离与基线修复（pr-6）

| 优化项 patch | 原链位 |
|---|---|
| `test-server-test-baseline-patch1.patch` | 12,12,47 |
| `test-chapter-27-tests-patch1.patch` | 58,58,60 |

## vcc/ — vcc 算法压缩（pr-7）

| 优化项 patch | 原链位 |
|---|---|
| `vcc-compactor-patch1.patch` | 14,14,40 |
| `vcc-autocompact-window-tiers-patch1.patch` | 22,22 |
| `vcc-compact-dead-import-patch1.patch` | 36,36 |
| `vcc-calibration-scripts-patch1.patch` | 59,59 |

## computer-use/ — Computer Use 解锁 Linux + 连接器平台（pr-8）

| 优化项 patch | 原链位 |
|---|---|
| `computer-use-connector-linux-patch1.patch` | 16,16 |
| `computer-use-linux-patch1.patch` | 18,18,32,33 |

## thinking-subagent/ — 思考计时与子代理用量（pr-10）

| 优化项 patch | 原链位 |
|---|---|
| `thinking-subagent-thinking-tool-timing-patch1.patch` | 21,21,28,29,39,41,43,49,61 |
| `thinking-subagent-split-no-double-count-patch1.patch` | 52,52 |
| `thinking-subagent-subagent-usage-cross-client-patch1.patch` | 63,63 |

> 主题 = 上游 PR 的 8 个功能域（h5 / session / tps / usage / test / vcc / computer-use / thinking-subagent）。
> 优化项与链位的对应依据 `pr-prepare/00-overview.md` 的「链位→PR 组」表。
> 原 67 个平铺补丁见 `modify/archive/patches-flat-20261003/`；上一版按章分组见 `modify/archive/patches-by-chapter-20261003/`。
