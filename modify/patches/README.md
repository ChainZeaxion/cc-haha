# modify/patches —— 两段式 15 patch 体系

结构：`patches/<主题>/<主题>-bundle-patch1.patch`（段一，一域一文件）+ `patches/<主题>/<优化项>-patch1.patch`（段二，独立项）。

**应用顺序 = `ORDER.md` 自上而下**（15 个 patch，两段）。

```bash
while read -r p; do git apply -p1 "$p"; done < modify/patches/ORDER.md
```

> ⚠️ **两个基座，两段平行，不要混用**（2026-10-14 重排后口径）
> - **段一（前 8 条）**：基座 = 上游 `068b3ebd`（**0.6.6 血缘**），链终态 = `cchaha-06scode` 树。这 8 个域 bundle 是 **PR 提交层**（`pr-prepare/`）的来源，目标 `NanmiCoder/cc-haha`。
> - **段二（后 7 条）**：基座 = `cchaha-067scode` 的 **`3a51ef84`（0.6.7 血缘）**，连续 apply 终态 = HEAD。**不可**接在段一终态之后（h5-file-open 的 66 文件中 56 个在 0.6.6 基座不存在或布局不同）。
> - 权威校验（2026-10-14）：段一终态树 = 原 36 条链终态树（`42905e42f`，diff 零字节）；段二终态树 = 原 9 条（旧 37-45）重放终态树（diff 零字节）。

## 2026-10-14 重排：45 → 15

原 45 个单优化项 patch（36 链式 + 9 独立）按关联度合并：36 条链式并为 8 个域 bundle，独立层 38+41（同改压缩触发判据）、43+45（TPS 一脉）各并为一。被合并的原文件与合并映射见 `modify/archive/patches-merged-20261014/`。

## 段一 —— 域 bundle（基座 068b3ebd，PR 层）

| 域 bundle | 收纳原 patch（旧链位） |
|---|---|
| `h5/h5-bundle-patch1.patch` | h5-access-token(1), h5-settings-parity(3), h5-mobile-quick-actions(11), h5-mobile-scheduled(13), h5-mobile-market-layout(15), h5-mobile-run-records(23), h5-local-index-multi-root(26) |
| `session/session-bundle-patch1.patch` | session-export(2), session-refresh(4), session-file-download(6), session-disable-updates(7), session-thinking-switch(9), session-gzip-transport(18), session-history-transport(21), session-baseline-typecheck(22), session-open-speed(28), session-upstream-session-id(35), session-local-index-budget(36) |
| `tps/tps-bundle-patch1.patch` | tps-indicator(5), tps-engine-rewrite(31), tps-density-estimation(33), tps-session-total(34) |
| `usage/usage-bundle-patch1.patch` | usage-cache-billing(8), usage-context-usage-anchor(17), usage-session-speed-usage-pairing(25) |
| `test/test-bundle-patch1.patch` | test-server-test-baseline(10), test-chapter-27-tests(29) |
| `vcc/vcc-bundle-patch1.patch` | vcc-compactor(12), vcc-autocompact-window-tiers(20), vcc-compact-dead-import(24), vcc-calibration-scripts(30) |
| `computer-use/computer-use-bundle-patch1.patch` | computer-use-connector-linux(14), computer-use-linux(16) |
| `thinking-subagent/thinking-subagent-bundle-patch1.patch` | thinking-subagent-thinking-tool-timing(19), thinking-subagent-split-no-double-count(27), thinking-subagent-subagent-usage-cross-client(32) |

> 域 bundle 的生成是**链序全量 apply 后按域文件并集切分**（非独立 diff）：28 个跨域共享文件（`chatStore.ts`/`sessionService.ts`/五 locale 等）归属最先应用域，故**应用顺序不可调换**（h5→session→tps→usage→test→vcc→computer-use→thinking-subagent，即域首链位序）。

## 段二 —— 独立优化项（基座 3a51ef84，0.6.7 血缘）

| 优化项 patch | 收纳 | 说明 |
|---|---|---|
| `h5/h5-file-open-patch1.patch` | 原 37 | H5 文件打开四轮（66 文件） |
| `usage/usage-context-estimation-patch1.patch` | **原 38+41** | 压缩双百分比分档+保留预算、上下文估算口径统一（14 文件，同改 `autoCompact{,.test}.ts`） |
| `prompt/prompt-i18n-localization-patch1.patch` | 原 39 | 提示词中文化 + 中文思考 + 语言开关（48 文件） |
| `h5/h5-provider-test-buttons-patch1.patch` | 原 40 | H5 模型配置测试/获取按钮（8 文件） |
| `compact/compact-summary-anchor-patch1.patch` | 原 42 | 摘要身份锚点 isCompactSummary 贯通（9 文件） |
| `tps/tps-estimation-unified-patch1.patch` | **原 43+45** | TPS 估算统一 + ids 探测/校准修复 + 在飞用量三缺口（密度池 counts 补喂/v2 清毒/4×units 护栏、stream_retry exact 回滚）（15 文件，同改 tpsMeter/chatStore） |
| `workspace/workspace-history-budget-degrade-patch1.patch` | 原 44 | 超预算会话工作区降级（4 文件） |

> 段二各 patch 的基座原来各自独立（37/38=`3a51ef84`、39=`cb7065b1e`、40=`53199e3f7`、41=`c71ce319d`、42=`54ae13c69`、43=`d240afe84`、44=`dfbfe9dc5`、45=`782661ba7`，全在同一直线上）。合并后 10（38+41）统一基座 `3a51ef84`、14（43+45）统一基座 `d240afe84`，其余沿用原文件（基座即 `3a51ef84`，逐条 apply 已实测通过）。

> 主题 = 上游 PR 的 8 个功能域（h5 / session / tps / usage / test / vcc / computer-use / thinking-subagent）。
> 优化项与旧链位的对应依据 `pr-prepare/00-overview.md` 的「链位→PR 组」表。
> 历史归档：原 45 个平铺（合并前）见 `modify/archive/patches-merged-20261014/`；更早的 67 平铺见 `modify/archive/patches-flat-20261003/`；按章分组版见 `modify/archive/patches-by-chapter-20261003/`。
