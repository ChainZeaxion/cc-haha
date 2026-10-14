# pr-prepare — 双层版总览（主题 / 优化项，对齐 `modify/patches/`）

- 基座：`068b3ebd`（上游 main 的祖先）
- 上游 main 现状：`6b9d2aec`（自基座改动 **820** 文件）
- 结构：`pr-prepare/<主题>/`（= `modify/patches/<主题>/` 的 **PR 提交层**，多出 `00-group.patch` + `README.md` + `manifest.md`）
- 全链：原 **34 个优化项 patch**；**2026-10-14 起 `modify/patches/` 已合并为 15 个**（段一 8 个域 bundle 对应本文 8 主题，见下表「现 bundle」列），本表保留旧「优化项→链位」映射供追溯。段二 7 个独立项（0.6.7 血缘）**不属于本 PR 层**，见 `modify/patches/ORDER.md`。
- 链终态 tree **`56923871`**（34 项时代口径；bundle 合并后终态不变，实测与原 36 条链逐字节一致）
- 提 PR 粒度：**整主题组补丁** `pr-prepare/<主题>/00-group.patch`（基座 `068b3ebd` → 该主题终态；**8 组并集 == 链终态**）
- PR 目标：`NanmiCoder/cc-haha`，head = `ChainZeaxion/cc-haha` 分支 `pr/<slug>`（**2026-10-03 已按本轮链终态原地更新**）
- 原「pr-N 目录 + 链位命名（64 项）」已归档：`pr-prepare/archive/pr-by-chain-20261003/`

> 本文件是 `modify/patches/README.md` 所引的「链位 → PR 组」权威映射来源。

## 一、主题 → PR → 规模

| 主题 | PR | 分支 | 功能域 | 项数 | 组行数 | 组文件 | 净新 | 上游也改过 | 组补丁 | 现 bundle（2026-10-14） |
|---|---|---|---|---|---|---|---|---|---|---|
| `h5` | #1415 | `h5-remote-access` | H5 远程访问与移动端支持 | 7 | +8401−639 | 83 | 16 | 27 | `h5/00-group.patch` | `h5/h5-bundle-patch1.patch` |
| `session` | #1411 | `session-related-optimizations` | 会话及相关优化（会话基础 + 文件下载 + 大会话加载/传输性能 + 打开提速） | 9 | +7725−333 | 78 | 18 | 27 | `session/00-group.patch` | `session/session-bundle-patch1.patch` |
| `tps` | #1414 | `tps-indicator` | TPS 实时解码速度指示器 | 4 | +9052−212 | 74 | 24 | 26 | `tps/00-group.patch` | `tps/tps-bundle-patch1.patch` |
| `usage` | #1412 | `usage-billing` | 上下文缓存计费与用量聚合显示 | 3 | +1250−152 | 26 | 2 | 10 | `usage/00-group.patch` | `usage/usage-bundle-patch1.patch` |
| `test` | #1409 | `test-baseline` | 测试环境隔离与基线修复 | 2 | +461−45 | 31 | 1 | 9 | `test/00-group.patch` | `test/test-bundle-patch1.patch` |
| `vcc` | #1410 | `vcc-compaction` | vcc 算法压缩 | 4 | +7650−61 | 58 | 47 | 3 | `vcc/00-group.patch` | `vcc/vcc-bundle-patch1.patch` |
| `computer-use` | #1416 | `computer-use-linux` | Computer Use 解锁 Linux(X11) + 连接器平台 | 2 | +2113−110 | 40 | 3 | 7 | `computer-use/00-group.patch` | `computer-use/computer-use-bundle-patch1.patch` |
| `thinking-subagent` | #1417 | `thinking-subagent` | 思考计时与子代理用量 | 3 | +7850−255 | 72 | 12 | 21 | `thinking-subagent/00-group.patch` | `thinking-subagent/thinking-subagent-bundle-patch1.patch` |

## 二、链位 → 主题 / 优化项（权威映射，34 项历史口径）

> ⚠️ 下列单项 patch 文件已于 2026-10-14 归档至 `modify/archive/patches-merged-20261014/`，各主题原项合并为「现 bundle」（见上表末列）。本表保留历史映射。

| 主题 | 优化项 patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| h5 | `h5-access-token-patch1.patch` | 1,2,5 | +2480−144 | 34 |
| h5 | `h5-settings-parity-patch1.patch` | 4 | +212−134 | 4 |
| h5 | `h5-mobile-quick-actions-patch1.patch` | 13 | +251−0 | 3 |
| h5 | `h5-mobile-scheduled-patch1.patch` | 15 | +4−3 | 2 |
| h5 | `h5-mobile-market-layout-patch1.patch` | 17 | +1−1 | 1 |
| h5 | `h5-mobile-run-records-patch1.patch` | 34 | +52−1 | 2 |
| h5 | `h5-local-index-multi-root-patch1.patch` | 46,48 | +292−121 | 4 |
| session | `session-export-patch1.patch` | 3 | +493−38 | 5 |
| session | `session-refresh-patch1.patch` | 6 | +183−7 | 2 |
| session | `session-file-download-patch1.patch` | 8,45,51,53 | +644−44 | 15 |
| session | `session-disable-updates-patch1.patch` | 9 | +145−1 | 4 |
| session | `session-thinking-switch-patch1.patch` | 11 | +349−7 | 11 |
| session | `session-gzip-transport-patch1.patch` | 20,25 | +415−1 | 3 |
| session | `session-history-transport-patch1.patch` | 23,24,26,31 | +363−16 | 9 |
| session | `session-baseline-typecheck-patch1.patch` | 27 | +7−4 | 2 |
| session | `session-open-speed-patch1.patch` | 55,56,57 | +526−22 | 6 |
| tps | `tps-indicator-patch1.patch` | 7,30,35,38,42,44,50,54 | +2743−14 | 25 |
| tps | `tps-engine-rewrite-patch1.patch` | 62,64,65,67 | +2269−1002 | 25 |
| tps | `tps-density-estimation-patch1.patch` | 66 | +728−43 | 10 |
| tps | `tps-session-total-patch1.patch` | 新增 | +118−70 | 5 |
| usage | `usage-cache-billing-patch1.patch` | 10 | +311−30 | 7 |
| usage | `usage-context-usage-anchor-patch1.patch` | 19 | +74−12 | 4 |
| usage | `usage-session-speed-usage-pairing-patch1.patch` | 37 | +375−41 | 11 |
| test | `test-server-test-baseline-patch1.patch` | 12,47 | +115−16 | 10 |
| test | `test-chapter-27-tests-patch1.patch` | 58,60 | +180−28 | 18 |
| vcc | `vcc-compactor-patch1.patch` | 14,40 | +5794−35 | 48 |
| vcc | `vcc-autocompact-window-tiers-patch1.patch` | 22 | +144−26 | 2 |
| vcc | `vcc-compact-dead-import-patch1.patch` | 36 | +1−3 | 3 |
| vcc | `vcc-calibration-scripts-patch1.patch` | 59 | +1518−0 | 3 |
| computer-use | `computer-use-connector-linux-patch1.patch` | 16 | +21−11 | 4 |
| computer-use | `computer-use-linux-patch1.patch` | 18,32,33 | +1473−81 | 31 |
| thinking-subagent | `thinking-subagent-thinking-tool-timing-patch1.patch` | 21,28,29,39,41,43,49,61 | +3346−139 | 54 |
| thinking-subagent | `thinking-subagent-split-no-double-count-patch1.patch` | 52 | +166−14 | 4 |
| thinking-subagent | `thinking-subagent-subagent-usage-cross-client-patch1.patch` | 63 | +1067−39 | 11 |

## 三、组装规则（重要）

- **域 bundle**（`modify/patches/<主题>/<主题>-bundle-patch1.patch`，2026-10-14 合并后形态）= 链内顺序产物；**必须按 `ORDER.md` 顺序 apply**（域按最小链位排序，28 个跨域共享文件归属最先应用域，顺序不可调换）。原 34 个单项 patch 归档于 `modify/archive/patches-merged-20261014/`，单独抽一项 apply 不保证成功。
- **组补丁**（`pr-prepare/<主题>/00-group.patch`）的文件集 = 本主题优化项**直接改动**的文件 ∪ 跨主题**共享文件**（按「本主题是该文件在链内**最后归属主题**」判定），共享文件内容取**链终态**。
  → 组内自洽（typecheck 不缺符号）；**8 组的文件集并集 == 链终态的改动文件集**，且共享文件在各组中标为同一链终态内容（内容一致）。
- ⚠️ **每个组补丁只在干净基座 `068b3ebd` 上单独 apply**（已验证：8/8 干净，且各自精确复现对应分支树）。**不要把 8 个组补丁在本机顺序叠加**——共享文件会被重复改写而报「补丁未应用」。上游侧逐 PR 合入时由 git 三方合并处理共享文件（内容相同 ⇒ 无冲突）。
- 组件关系：**无强依赖**，每组自洽。

## 四、建议合入顺序（减少后续组冲突面）

`test` → `vcc` → `session` → `usage` → `tps` → `h5` → `computer-use` → `thinking-subagent`
（`thinking-subagent` 依赖 `tps` 的 tpsMeter stream 标记与 `usage` 的 usage 口径；`usage` 依赖 `session` 的 `transcriptMetadataCache.ts`。）

## 五、验收口径

- 桌面：`cd desktop && bunx vitest run`（**必须在 `desktop/` 下跑**）
- 服务端：`bun test src/server`（**勿**用 `bun test src`）
- typecheck：注意基座 `tsconfig.json` 的 `baseUrl` 会让 `tsc --noEmit` **在配置阶段中止（TS5102，空转）**，须去 `baseUrl` 后跑 —— 详见 `VERIFICATION.md`。
