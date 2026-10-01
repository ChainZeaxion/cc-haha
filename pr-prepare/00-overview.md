# 按功能拆分向上游 NanmiCoder/cc-haha 提交 PR — 方案总览

- 基座：`068b3ebd`（全链 patch 的重基基线，是上游 main 的祖先）
- 上游 main 现状：`2ec845d0`（领先基座 45 个提交，503 个文件有改动）
- 全链：64 个 patch（modify/patches/），按链位顺序 apply 可 100% 复现工作树终态
- 策略：每组分支 = 基座 `068b3ebd` + 本组 patch 顺序应用（共享文件按「链内最后归属组」切分，import 闭包补齐至自洽）。**不整体合并上游 main**：上游已动 503 文件，整体合并会让每个 PR 混入大量无关提交；本组与上游改动的文件交集（冲突风险）见各组清单，上游若真冲突再三方合并。
- PR 目标：`NanmiCoder/cc-haha`，head = `ChainZeaxion/cc-haha` fork 分支 `pr/<slug>`
- 旧 PR #1394（43 项大合集）在拆分 PR 全部打开后 close（注明由本组 PR 取代）

## PR 分组（10 组，按功能域）

| PR | 分支 | 功能域 | 章节 | patch 数 | 文件数 | 上游冲突风险文件 |
|----|------|--------|------|---------|--------|------------------|
| pr-1 | `h5-remote-access` | H5 远程访问与移动端支持 | 一/九/十一/十四/十五/十七/二十五/十补记 | 10 | 83 | 16 |
| pr-2 | `session-core` | 会话基础功能（导出/刷新/禁更新/思考开关） | 二/三/六/八 | 4 | 52 | 11 |
| pr-3 | `tps-indicator` | TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎） | 四/二十八.1/二十八.4 | 10 | 60 | 18 |
| pr-4 | `file-download-speed` | 文件下载桥接 + 大会话打开提速 | 五/五补记(链位55-57) | 7 | 35 | 8 |
| pr-5 | `usage-billing` | 上下文缓存计费与用量聚合显示 | 七/十九/四子优化(速度配对) | 3 | 26 | 9 |
| pr-6 | `test-baseline` | 测试环境隔离与基线修复（含章内残余 hunk） | 十二/二十七.1/二十七.3 | 4 | 31 | 4 |
| pr-7 | `vcc-compaction` | vcc 算法压缩（pi-vcc 移植 + 窗口分档 + 降级兜底 + 校准脚本） | 十三/二十四/二十七.2 | 5 | 58 | 3 |
| pr-8 | `computer-use-linux` | Computer Use 解锁 Linux(X11) + 连接器平台支持 | 十八/十六 | 4 | 40 | 7 |
| pr-9 | `large-session-perf` | 大体积会话加载与传输性能（历史膨胀治理 + gzip 传输） | 二十二/二十 | 7 | 16 | 3 |
| pr-10 | `thinking-subagent` | 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进） | 二十一/二十六/二十八.2/二十五 | 10 | 73 | 18 |

## patch → 组 对照（按链位）

| 链位 | patch | PR 组 |
|------|-------|-------|
| 1 | `h5-require-token.patch` | pr-1 |
| 2 | `h5-auto-mode-optin.patch` | pr-1 |
| 4 | `h5-settings-parity.patch` | pr-1 |
| 5 | `h5-terminal-bridge.patch` | pr-1 |
| 13 | `h5-mobile-quick-actions.patch` | pr-1 |
| 15 | `h5-mobile-scheduled.patch` | pr-1 |
| 17 | `h5-mobile-market-layout.patch` | pr-1 |
| 34 | `h5-mobile-run-records.patch` | pr-1 |
| 46 | `local-index-extra-project-roots.patch` | pr-1 |
| 48 | `session-list-multi-root-validation.patch` | pr-1 |
| 3 | `session-export.patch` | pr-2 |
| 6 | `session-refresh.patch` | pr-2 |
| 9 | `disable-updates.patch` | pr-2 |
| 11 | `thinking-switch.patch` | pr-2 |
| 7 | `tps-indicator.patch` | pr-3 |
| 30 | `tps-centered-second-line.patch` | pr-3 |
| 35 | `tps-real-token-accounting.patch` | pr-3 |
| 38 | `tps-content-accounting.patch` | pr-3 |
| 42 | `tps-burst-anchor.patch` | pr-3 |
| 44 | `tps-tokens-kind-and-reasoning-passthrough.patch` | pr-3 |
| 50 | `tps-phase-switch-steady-window.patch` | pr-3 |
| 54 | `tps-batched-delivery.patch` | pr-3 |
| 62 | `tps-bucket-engine-rewrite.patch` | pr-3 |
| 64 | `tps-background-freeze.patch` | pr-3 |
| 8 | `file-download.patch` | pr-4 |
| 45 | `file-download-attr.patch` | pr-4 |
| 51 | `file-download-blob.patch` | pr-4 |
| 53 | `file-download-anchor.patch` | pr-4 |
| 55 | `session-history-context-durable.patch` | pr-4 |
| 56 | `session-find-bounded-read.patch` | pr-4 |
| 57 | `transcript-metadata-durable.patch` | pr-4 |
| 10 | `cache-billing.patch` | pr-5 |
| 19 | `context-usage-anchor.patch` | pr-5 |
| 37 | `session-speed-and-usage-pairing.patch` | pr-5 |
| 12 | `server-test-baseline-zeroing.patch` | pr-6 |
| 47 | `test-model-env-isolation.patch` | pr-6 |
| 58 | `chapter-27-test-env-isolation.patch` | pr-6 |
| 60 | `chapter-27-residual-hunks.patch` | pr-6 |
| 14 | `vcc-compactor.patch` | pr-7 |
| 22 | `autocompact-window-tiers.patch` | pr-7 |
| 36 | `compact-dead-import-cleanup.patch` | pr-7 |
| 40 | `vcc-compact-fallback.patch` | pr-7 |
| 59 | `chapter-27-vcc-calibration-scripts.patch` | pr-7 |
| 16 | `connector-linux-platform.patch` | pr-8 |
| 18 | `computer-use-linux-x11.patch` | pr-8 |
| 32 | `computer-use-platform-components.patch` | pr-8 |
| 33 | `computer-use-python-path-fallback.patch` | pr-8 |
| 20 | `h5-gzip-transport.patch` | pr-9 |
| 23 | `history-transport-bounds.patch` | pr-9 |
| 24 | `file-history-dedup.patch` | pr-9 |
| 25 | `gzip-transport.patch` | pr-9 |
| 26 | `history-first-paint-bound.patch` | pr-9 |
| 27 | `baseline-typecheck-fixes.patch` | pr-9 |
| 31 | `storage-original-file-bound.patch` | pr-9 |
| 21 | `thinking-tool-timing.patch` | pr-10 |
| 28 | `thinking-badge-order-and-duration.patch` | pr-10 |
| 29 | `turn-usage.patch` | pr-10 |
| 39 | `subagent-background-task-durations.patch` | pr-10 |
| 41 | `background-task-duration-restore.patch` | pr-10 |
| 43 | `think-token-truth-chain.patch` | pr-10 |
| 49 | `subagent-usage-split-live.patch` | pr-10 |
| 52 | `split-no-double-count.patch` | pr-10 |
| 61 | `subagent-live-metrics.patch` | pr-10 |
| 63 | `subagent-usage-cross-client.patch` | pr-10 |

## 组间关系与合入顺序建议

- **无强依赖**：每组自洽，各组终态组合=全链终态。
- 建议合入顺序（减少后续组的冲突面）：pr-6 测试基线 → pr-7 vcc 压缩 → pr-9 大会话性能 → pr-2 会话基础 → pr-4 文件下载+提速 → pr-5 计费与用量 → pr-3 TPS → pr-1 H5/移动端 → pr-8 Computer Use Linux → pr-10 思考计时与子代理用量（依赖 pr-3 的 tpsMeter stream 标记与 pr-5 的 usage 口径）。

## 每个 PR 的验收口径

- 桌面：`cd desktop && bunx vitest run`（必须在 desktop/ 下跑）
- 服务端：`bun test src/server`（**勿**用 `bun test src`）
- typecheck：`bunx tsc --noEmit`