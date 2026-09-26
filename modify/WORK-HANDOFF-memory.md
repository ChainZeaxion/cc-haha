# cc-haha 0.6.6 重实现 — 交接检查点（2026-09-26 更新：十九章 #85 完成，22 链）

## 最新状态

- **分支**：custom-066，最新 commit `fa366de7`（docs+patch: #85 章十九回写）← `94c8f0f7`（#85 章十九实施，4 文件 74 行）。
- **本轮完成（task#2/#3，接续点 #85 WIP）**：十九 bc 压缩后 context usage 不收敛——WIP 验证后提交。
  - **核心（方案 A 治本）**：`sessionService.ts:2970` `buildTranscriptContextEstimate` 的 `totalTokens` 从 `min(max(usedTokens, providerTokens+estAfter), raw)` 改为 `min(providerTokens+estAfter, raw)`——显示总量走 **usage 锚口径**（最后一条真实 usage 总量 + 其后 rough 累加），与 auto-compact 的 `tokenCountWithEstimation`（tokens.ts:299）同口径。bc 压缩后 usage 回落 → 百分比收敛，不再被自 boundary 全量 rough 累加（~787K=340% 窗口）钉死 100%。`estimatedTokens` 保留全量口径供媒体信任启发式；`ignoredUsageReason` 分支行为不变。
  - **伴随加固**：`sessionProjector.ts`——malformed transcript 把 thinking 文本误解析进 tool_use name，原单串 metadata 上限 4KB 过紧（实测 12KB 异常）→ 新增 `MAX_PROJECTION_METADATA_VALUE_BYTES=16KB`（且 `value.length` 字符判定改 `Buffer.byteLength` 字节判定）；总量 `MAX_PROJECTION_METADATA_BYTES` 16MB→32MB。
  - **验证**：新回归测试 `conversations.test.ts`「全量 rough(150k)≫真实 usage(1200) 时锚定 usage」（断言 totalTokens=1200/percentage=1/rawMax=200000）——stash 旧码 fail 钉住改动；src/server 4 家族 **488/488 绿**；tsc scoped 仅 TS5102 baseUrl 无害。
  - **patch**：`context-usage-anchor.patch`（4 文件 166 行）新增表行 21，h5-gzip 顺延 22；**22 链 fresh worktree@068b3ebd 顺序 apply FAIL=0，章十九 4 文件逐字节=工作树**。
  - **文档**：十九章 ⬜→✅ 回填实施+验证，两表 ⬜→✅，链规模 21→22。
- **十八章至本轮之间的既提交链**（WORK-HANDOFF 此前未覆盖）：`2d007b1a`/`ca4fc6c1`（#83 测试失败清零：1 真回归+3 环境泄漏+flaky 兜底 → server 全量 3442 零失败）→ `26375d8f`/`7f58a8f1`（二十 H5 远端 API gzip 压缩传输，省 68% 带宽，`h5-gzip-transport.patch`）→ `966ca8f1`/`7031e051`/`7062daaa`/`352e5241`/`297e9ea4`（二十二 TPS 展示改造+格式 "TPS XXXt/s"+4 位封顶 9999，`tps-indicator.patch` 重生成 8 文件 839 行，21 链验证）。

## 上一章状态（2026-09-26 14:00，task#81 上游融合）
- **本轮完成（task#81）**：上游 main `068b3ebd`（09-25，20 commit：pending 问题超时自动回答/聊天外观偏好/CORS 门控重做/OAuth 2.1.281/agent-teams/Kimi K3 图片透传等）融入 custom-066 + 19 patch 全部重基到 068b3ebd。
  - 提交链：a973e578 → `4e25e022`(merge 上游, 5 冲突全并集解决) → `005684ea`(修两处合并吞行+autoQuestion GET 测试期望) → `dbaa10b8`(MessagePayloadRetention 注释对齐上游) → `638c9bca`(AppShell 测试修复+19 patch 重基) → `50e0423f`(docs)。
  - **AppShell 既有回归修复**：chatStore mock 缺 `getSubordinateTpsMeters`（TPS 子代理汇聚引入）→ 补 `() => []`，22/22。
  - **19 patch 重基法（overlay 终态法）**：worktree@068b3ebd 每章 cp 终态文件→commit→相邻章 diff 出 patch。2 章变空 patch（h5-settings-whitelist/h5-mobile-market，共享文件 delta 被前序章覆盖，无损）；apply 用 `--allow-empty`。
  - **验证**：fresh worktree@068b3ebd 顺序 apply 19/19 全干净，终态 vs 工作树仅 4 已知非章 delta（bun.lock、TerminalSettings.tsx、providerModels.ts、preview-agent.js）。desktop tsc 0；desktop vitest 12456/2（2=MessageList 一条负载 flaky，隔离 201/201 绿）；server 6854/10（全 flaky，隔离全绿）。
- **桌面应用已编译**（合并前源码，符合「先编译当前版本」）：`desktop/build-artifacts/electron/` deb(201MB)+AppImage(253MB)+linux-unpacked，bundle App-C1OyVXUg.js（含 TPS 汇聚徽章，无上游新功能）。

## patch 体系（**22 链**，**基线 068b3ebd**）

顺序（自上而下 `git apply --allow-empty`）：h5-require-token → h5-auto-mode-optin → session-export → h5-settings-parity → h5-terminal-bridge → session-refresh → tps-indicator → file-download → disable-updates → cache-billing → thinking-switch → h5-settings-whitelist(空) → server-test-baseline-zeroing → h5-mobile-quick-actions → vcc-compactor → h5-mobile-market(空) → h5-mobile-scheduled → connector-linux-platform → h5-mobile-market-layout → computer-use-linux-x11 → **context-usage-anchor**（#85 十九）→ **h5-gzip-transport**（二十，末位）。

## 工作树未提交项（预期内，非章 delta）

- 大量 untracked `.js` 孪生（tsc emit，不入 git/patch：App-*.js、site/src/**/*.js）
- 树级 delta vs 22 链终态：#83 测试修复族（conversations/sessions/contextBudget 等 4 家族已随十九提交，余为 desktop/src 侧）+ 既有 bun.lock/TerminalSettings.tsx/providerModels.ts

## 待办

- ~~task #78：十八章 Computer Use Linux 门控放宽+状态页~~ ✅ 已完成
- ~~task #75：实施 linux_helper（X11 像素面）~~ ✅ 已完成
- ~~#85：bc 压缩后 context usage 不收敛（十九）~~ ✅ 已完成（94c8f0f7 + fa366de7，22 链验证）
- **第二十一章**（每次思考耗时记录并在对话记录展示，仿工具执行耗时横条）——已登记 ⬜ 待办，暂不推进
- **#89 诊断降级 62/63**（in_progress，独立优化项，与十九 WIP 文件不相交）
- **#88 computer use 环境组件**（in_progress）
- H5 市场显示 6 问题清单（已调研未实施，等用户圈范围）
- 可选后续：Linux 桌面端（非 H5）Computer Use 设置页 live 走一遍 Python 安装流（venv 建+依赖装）端到端；合并后如需重新出桌面包：`cd desktop && bun run electron:package`（产物落 build-artifacts/electron/）

## 环境速记

- dev 7788 运行中；H5 token `h5_H7kDPNb-KkhMnULdmQ-B0eoAd8ey-Pcc9PhtcpbeSUQ`
- 文档：`modify/cc-haha自定义优化-0.6.6重实现.md`（Patch 清单已重基到 068b3ebd，含应用法说明）
- 上游 remote：cchaha-06scode 的 origin 指向 /home/zeaxion/myproject/cc-haha；refs/upstream/main=068b3ebd
