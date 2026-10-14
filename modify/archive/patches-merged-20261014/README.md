# patches-merged-20261014 —— 45→15 合并前的旧 patch 归档

2026-10-14 重排：45 个单优化项 patch 合并为 15 个（8 域 bundle + 7 独立项）。本目录保存被合并的 40 个原文件。合并映射：

## 段一（36 链式 → 8 域 bundle，基座 068b3ebd）

| 新 bundle | 收纳（本目录路径） |
|---|---|
| h5-bundle | h5/{access-token, settings-parity, mobile-quick-actions, mobile-scheduled, mobile-market-layout, mobile-run-records, local-index-multi-root} |
| session-bundle | session/{export, refresh, file-download, disable-updates, thinking-switch, gzip-transport, history-transport, baseline-typecheck, open-speed, upstream-session-id, local-index-budget} |
| tps-bundle | tps/{indicator, engine-rewrite, density-estimation, session-total} |
| usage-bundle | usage/{cache-billing, context-usage-anchor, session-speed-usage-pairing} |
| test-bundle | test/{server-test-baseline, chapter-27-tests} |
| vcc-bundle | vcc/{compactor, autocompact-window-tiers, compact-dead-import, calibration-scripts} |
| computer-use-bundle | computer-use/{connector-linux, linux} |
| thinking-subagent-bundle | thinking-subagent/{thinking-tool-timing, split-no-double-count, subagent-usage-cross-client} |

## 段二（9 独立 → 7，基座 3a51ef84 线）

| 新 patch | 收纳（本目录路径） |
|---|---|
| h5-file-open（不变） | — |
| usage-context-estimation | vcc/compaction-retention-budget（原 38）+ usage/context-estimation（原 41 旧版） |
| prompt-i18n-localization（不变） | — |
| h5-provider-test-buttons（不变） | — |
| compact-summary-anchor（不变） | — |
| tps-estimation-unified | tps/estimation-unified（原 43 旧版）+ tps/ids-probe-calibration（原 45） |
| workspace-history-budget-degrade（不变） | — |

应用方式与权威校验结论见 `modify/patches/ORDER.md` 与 `modify/patches/README.md`。
