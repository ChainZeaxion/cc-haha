# cc-haha 0.6.6 重实现 — 交接检查点（2026-09-29 更新：28 章 + 七处真根因，64 链）

## 最新状态（2026-09-29）

- **分支**：custom-066。**链 61 → 64**（新增链位 **62** `tps-bucket-engine-rewrite.patch`、**63** `subagent-usage-cross-client.patch`、**64** `tps-background-freeze.patch`）。
- **本轮完成**：
  - **① TPS 速率引擎重写为 125ms 分桶（链位 62，`e4b737dc`）**：按用户 5 条规格**推倒旧连续滑窗**（`sliceRate`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindowAt` 等整块删除）。每 125ms 一桶、显示＝最近 8 桶均值、**只读已完成桶**、首桶不单独显示、尾桶 50/50、结束后保持 5 分钟（**引擎真值优先**）、**生成钟优先到达钟兜底**。⚠️ 两钟**绝不可混算**（`serverTs` epoch vs `performance.now`），时钟选择**粘性**。19 文件。
  - **② 子代理跨客户端用量一致性（链位 63）**：两个根因都修完才对得上 ——
    - **真根因＝身份混用**：`runAgentId`（run 自己的 id）与「派发它的 Agent 工具调用 id」（`tool_use_id`）**都各自被当键用**：UI 按 `toolUseId` 读，而实时写入方把它**填成了 runAgentId** ⇒ 后加入的客户端把数字写进一张**永远读不到**的行，直到跨过工具轮次边界才「突然出现」。服务端改为下发 `{taskId, toolUseId}` **且身份无总量也发**（长生成期才是身份最要紧的时候）。
    - **基线缺失**：种子原来自转录 rollup，而它**只在越过分界后有值** ⇒ 后加入者从 0 起。新增服务端**在飞外推器** `agentRunUsageProjection.ts`（计数点＝`notifyOutputCallbacks` 之前，**每会话每条消息恰好一次**；镜像客户端的 delta 规则**及「哪些不计」**），种子取 `max(rollup, projection)` ⇒ **估计绝不盖过终局真值**。
    - 顺带修：基准被采用后**必须记账**（`lastWritten = reported`），否则「无变化的写入被跳过」会让数字永远爬不动。
  - **③ 用户实测确认达标**：B「能接近及时看到用量在跑」，且**与 A 的数值一致**。
- **验证**：`check:server` **496 文件 / 5975 条 / 0 失败**；`tsc` / lint 绿；链复现度 **64/64 apply 0 失败**，链终态 vs 工作树**仅差** `bun.lock` + `preview-agent.js`（2 个既定排除项）。
- **文档**：新增**二十八章**（28.1 TPS 重写 / 28.2 跨客户端一致性 / **28.3 Step 2 补充参考（未实施：WS 推送 + REST 轮询）** / 28.4 后台标签页冻结 / 28.5 链复现度）；链位表补 62、63；§27 那份过时的「已知非章 delta」清单已标注失效并指向 §28.4。
- **deb（含链位 62/63/64，2026-09-29 16:57）**：日志 `/tmp/build-deb-20260929c.log`；产物 `desktop/build-artifacts/linux-x64/Claude-Code-Haha-0.6.6-linux-amd64.deb`（201,443,684 B）。**核验口径（不是看时间戳）**：解包后与仓库 `dist` **逐字节比对** —— 入口 `index-BCw1Lx6-.js`、含修复的 `App-CrP7x1SQ.js` / `PetRenderer-BlXTxiHU.js`、`index.html` **全部 cmp 相同**；包内 sidecar 亦为 16:57 重建。**待安装验证。**
- **④ 后台标签页切回后 TPS 飙高 / 卡着不动（链位 64，已完成）**：浏览器后台节流 ⇒ 切回时**整段积压在同一瞬间交付**、落进同一个到达 125ms 桶；而摊平只在**环内能找到更早有内容桶**时才做 ⇒ 长静默清环后 `previous === -1` 被当成「run 起点」**不摊平** ⇒ 整段按一个桶计费。实测读数序列 **0 → 25,012 → … → 6,331 → 104**：**「卡住」＝先读出 0 被指示器防闪规则无限期冻结，「飙高」＝紧随其后的巨桶，同源**。修法＝积压桶**丢弃**（粘性化）+ 丢弃桶**不进分母**（是「没测到」不是「空 125ms」）+ 跨静默**保留最后读数** + 指示器防闪保持**改为有界 1.5s**。**生成钟（serverTs）本来就挺得住（全程 104）**，这条修的是到达钟回退路径。4 文件。

## 历史状态（2026-09-28）

- **分支**：custom-066。本轮 11 个提交（`94e7da43` → `d1a444f2`），链 **43 → 51**。
- **本轮完成**（用户当轮诉求全部落地）：
  - **① TPS 脉冲修复（链位 44，`tps-burst-anchor.patch`）**：生产实测 TPS 爆到 1000-2000（真值 230-280）。真因=生产 deb 的 bundle **根本没有** `preWindowAt` 锚——该修法此前**只在工作区、从未提交**，故重装任何既有 deb 都不会好。修法=窗口跨度过小时用「刚滑出窗口的样本时刻」作分母，而非 400ms 地板。**结论：需重新出包并安装**。
  - **② 思考 token 走引擎真值（链位 45）** + **`tps_tokens` kind 归因 + reasoning 透传（链位 46）**。
  - **③ 下载锚点修复（链位 47）**：`downloadLocalFile` 缺 `anchor.download` ⇒ 点击变导航、`file://` 下被来源门控拒掉；该入口此前零测试，已补 4 条。
  - **④ 本地索引额外根（链位 48）+ 会话列表多根校验（链位 50）**：dev 会话列表 **2 → 84**。⚠️ 关键教训=修好「发现」≠修好「列表」，第二层逐行校验会**静默丢弃**额外根的行（`total` 报对、行数少），必须验**返回条数**。
  - **⑤ 测试 env 隔离（链位 49）**：`bun test src/utils` 整目录 34 fail 是**假红**（`mock.module` 泄漏 + ambient env），官方 `bun run check:server` 全绿（**493 文件 / 5947 条 / 0 失败**）。
  - **⑥ 子代理拆分显示 + 组栏实时跟进（链位 51，`subagent-usage-split-live.patch`）**：还原会话显示 think/非think 拆分（服务端从子代理转录推导，pilot 对账 Σtotal **727,879** / Σthink **457,330**）；组栏运行中跟进用量+耗时（**纯客户端**，`task_progress` 每轮本就在发），完成时以终值**二次校正**；节奏对齐思考徽章 3s。
- **验证**：`check:server` 493/5947/0；前端全量 **6341 passed / 0 failed**；`tsc -b` 0 错；**8 新链位（44-51）在 `d89c1405` worktree 按序 apply FAIL=0、并集与工作树逐字节一致**。
- **文档**：新增二十六章（含 **9 条踩坑**）；链位表 43 → 51；链规模行更新；附录补 2 条操作性教训（`pkill -f` 自匹配、`tsc -b` 是入库闸门）。
- **deb**：`/tmp/deb-build-4.log`（含全部 11 提交，与链终态一致）；产物 `desktop/build-artifacts/electron/Claude-Code-Haha-0.6.6-linux-amd64.deb`。**待安装验证。**
- **dev 服务**：7788 已重启（`/tmp/start7788.sh`，含 `CC_HAHA_EXTRA_PROJECT_ROOTS=/home/zeaxion/.claude/projects`）。
- **⚠️ TPS 脉冲第二轮（链位 52，`tps-phase-switch-steady-window.patch`）**：用户反馈装新 deb 后**仍**在相位切换处爆到 9999。查证 = 链位 44 的锚**确实在**生产 bundle 里（非制品陈旧），是**锚的条件太窄**（停滞冲刷恰落在 `span==400ms` 地板故不进锚）。离线复现 5 场景定位三处同源缺陷，收敛为一条规则（私有 `sliceRate()`：**一批 token 生成于它与前一批之间**；无前置样本则丢弃最旧那批；不可计时则持有），并按用户要求只算**稳态段**（`SETTLE_MS=230`）。正向副作用：稳态读数**精确化**（旧式 10 批除 9 个间隔，系统性偏高 11%）。**仍需重编 deb 并安装**。
  - 踩坑：① 自己写的反向遍历 `lastIndex=i; startIndex=i` 使 lastIndex 停在最旧索引 ⇒ 持有值恒 0（被测试当场抓住）；② 一度想给 `endCall` 加合理性上限，按证据否掉（其两入参在生产**同口径**：`QueryEngine` 的 `result` 里 `usage=totalUsage` 配 `decode_ms=totalDecodeMs`）；③ **验修法不能只 grep 符号**——锚「在制品里」不等于「生效」。
- **⚠️ 第三轮（链位 53/54，均已进生产）**：用户实测报两处——
  - **下载「无法从网站上提取文件」（链位 53 `file-download-blob`）**：实测同一路由**无 Origin→200、`Origin: null`→403**。打包版渲染进程在 `file://`，而 DOM 自发的下载请求其 Origin **序列化为 `null`**（门控认 `file://` 却不认 `null`）。**不放行 `null`**（=所有不透明来源的值，恶意页面的 sandbox iframe 即此 ⇒ 等于给本地 API 开后门），改修调用方：`apiGetBlob` 取字节 + blob（app icon 早有同款解法，`client.ts:459-463` 注释写明同一理由）。顺带纠正我早前写进注释的**未取证因果**（「下载卡片能用、树菜单不能」是错的，两者同样失败）。
  - **拆分「真实用量 0」（链位 54 `split-no-double-count`）**：一轮响应拆两条记录**共享 `message.id`**（思考一条 output=0 无 reasoning、正文一条带真值），估算又叠真值 ⇒ think > total ⇒ `max(0,total-think)` 恒 0。按响应 id 归组、真值胜过估算；实时 tracker 与服务端 rollup **两处同病同修**。dev 实测 **6/6 一致**、非思量由 0 变为正数。
- **生产装机已验证（14:02 deb）**：`App--vk5NH6C.js` 与产物**同名同内容**（含 `createObjectURL`）；`PetRenderer-CzXigudJ.js` 与产物 **md5 逐字节相同**（`78e1e161…`，含 `preWindowAt`/`lastIndex`/`sliceRate`）；sidecar 含 `thinkingEstimatesByResponse`。**三处修复全在生产。**
- **⚠️ 第四轮（链位 55/56）**：
  - **下载（55，第三次才做对）**：用户第三轮点破方向——「**文件浏览、文件预览的卡片是坏的，对话卡片能下**」。那句「能下」就是反证：卡片用的是**裸 anchor 指向 `/local-file/...?download=1`**，一直是好的。实测三态决定性地说明问题：**无 Origin（anchor 点击＝导航）→ 200 + `Content-Disposition`**；`Origin: null`（fetch）→ **403**；`Origin: file://` → 200。我此前测到 403 就断定「DOM 下载会被拒」，**错把导航当成了 fetch**（导航不带 Origin）；改 fetch+blob 反而把请求推进被拒路径，且 blob 在不透明来源不可下载**且不报错** ⇒ 现象升级为「毫无反应」。修法＝`downloadLocalFile` 回到初版形状（建 anchor→href 指路由→click），文件浏览/文件预览共用一个函数，删掉错误的 IPC 机件（7 文件，净 −282 行）。**真机验证：打包 app 的 `file://` 渲染进程里 anchor 导航下载真的落盘（CDP 捕获，内容一致）。**
  - **TPS（56）**：用户报「还是冲上 1600，尤其 bash 动作时」。bash 期间无解码 ⇒ 说明**持有值虚高**。离线复现：整块重放 **7153**、停顿后积压突发 **3603**（真值 250）。真因＝**打包投递被当成生成节奏**（重放/整块交付/页面忙时排队的中转帧；bash 输出正好占满主线程）。修法＝逐样本只计入到达间隔能支撑其实时速率的样本（上限 5000），延迟首批保留自身间隔。修后 250 / 383。
  - **我犯的错（已记档）**：① 抱着「DOM 下载被拒」的假设连改两轮，而**同代码里的可用入口（卡片）就是反证却没用**；② 把**构造的** `Origin: null` 请求当成真实点击的形状；③ 无头 Chrome 下载实验**无对照组**不该当证据；④ 并发跑两个重活致 2 条假失败（单独复跑全绿）；⑤ **用 `pkill -f` 误杀了用户的生产实例**——往后只按精确 PID 停自己起的进程。
- **本轮验证**：桌面 `tsc -b` 0 错；全量前端 **6346 通过 / 0 失败**；`check:server` **493 文件 5950 通过 / 0 失败**；`electron/ipc`+`services`+`workbench` **653 绿**；`handlePreviewLink` **38 绿**（下载段重写）；`tpsMeter`27+`tpsCalibration`8+`TpsIndicator`7=42 绿；链位 55/56 在链基 worktree apply **FAIL=0**；**真机 CDP：打包 app 里 anchor 导航下载落盘 PASS**。
- **待办**：① 装新 deb 后验证 TPS 不再脉冲 + 下载（文件浏览/文件预览两处）；② 把拆分机制推广到**全部历史会话**（当前按需推导已覆盖打开过的会话；若要一次性持久化进索引＝schema v6 + parser 跳变触发后台全量整理，独立一步）；③ `teammate`/嵌套子代理（一个 `toolUseId` 对多个转录）暂回落正则，未纳入推导。

---

## 最新状态

- **分支**：custom-066，最新 commit `ef8801e3`（#91 章二十一思考计时综合优化，19 代码文件+patch+文档+二十二章调研报告入库，22 文件 1988 增/73 删）。
- **本轮完成（task#4/#8，#91 章二十一）**：思考计时与工具计时综合优化——
  - **①单条思考 badge**：token（`xx.xxk` 估算，tpsMeter 同款 CJK/ASCII 口径）+ 耗时三档（`12.3s`/`3m05s`/`2h05m`）；进行中锚 **server `content_block_start` 时刻**（`serverStart` 逐 delta 透传，非客户端接收钟）每 3s 刷新，结束 settle 固定；`settleThinkingDurations` 覆盖全部 `activeThinkingId` 清空点（text/tool_use block_start、message_complete 两处、api_retry）。
  - **②收纳栏总计时**：`activityDurationMs` 墙钟跨度 → **分段求和**（Σ思考+Σ工具），修纯思考/尾思考回合漏计。
  - **③收纳栏 token 用量**：`activityTokenUsage/Label`——估算口径 `思考Xk + 工具Yk`（+ 分隔），真实回传口径合并总数；工具侧=`extractTextContent` 结果文本估算。
  - **H5「token 显示没了」根因+修**：H5 服务 `desktop/dist`，旧 bundle 无 badge 代码（前端必须 rebuild，服务端 bun 直跑源码即生效）；另修无耗时记录的旧会话 badge 整条消失 → 单显 token。重构建后 `data-thinking-usage` 入 App-DxDEHC6-.js，H5 无需重启。
  - **测试**：前端相关 444/444 绿（ThinkingBlock 22/ActivityGroup 16/chatBlocks 44/chatStore 354/tpsMeter 8）；server 3 家族 65/65；tsc 0 错。
  - **patch**：`thinking-tool-timing.patch`（19 文件 1052 行）第 23 位；**23 链 fresh worktree@068b3ebd 顺序 apply FAIL=0**，18/19 文件逐字节=工作树（api/claude.ts 仅已知 bound-thinking WIP delta，9c081af7 引入，非章 delta）。
  - **文档**：二十一章 ⬜→✅ 回填（实施/验证/踩坑 5 条）+章节名综合化；**新增二十三章「子代理内容实时反馈（opencode 式）」⬜ 待办仅登记**；分类目录两表同步。
- **deb 重编译**（22:44）：`desktop/build-artifacts/linux-x64/Claude-Code-Haha-0.6.6-linux-amd64.deb`（201MB，asar 含新 bundle App-DxDEHC6-.js 已验）。构建命令=`cd desktop && SKIP_INSTALL=1 LINUX_TARGETS=deb SKIP_PACKAGE_SMOKE=1 bash ./scripts/build-linux.sh`。

## 上一章状态（十九章 #85）

- **分支**：custom-066，commit `fa366de7`（docs+patch: #85 章十九回写）← `94c8f0f7`（#85 章十九实施，4 文件 74 行）。
- **本轮完成（task#2/#3，接续点 #85 WIP）**：十九 bc 压缩后 context usage 不收敛——WIP 验证后提交。  - **核心（方案 A 治本）**：`sessionService.ts:2970` `buildTranscriptContextEstimate` 的 `totalTokens` 从 `min(max(usedTokens, providerTokens+estAfter), raw)` 改为 `min(providerTokens+estAfter, raw)`——显示总量走 **usage 锚口径**（最后一条真实 usage 总量 + 其后 rough 累加），与 auto-compact 的 `tokenCountWithEstimation`（tokens.ts:299）同口径。bc 压缩后 usage 回落 → 百分比收敛，不再被自 boundary 全量 rough 累加（~787K=340% 窗口）钉死 100%。`estimatedTokens` 保留全量口径供媒体信任启发式；`ignoredUsageReason` 分支行为不变。
  - **伴随加固**：`sessionProjector.ts`——malformed transcript 把 thinking 文本误解析进 tool_use name，原单串 metadata 上限 4KB 过紧（实测 12KB 异常）→ 新增 `MAX_PROJECTION_METADATA_VALUE_BYTES=16KB`（且 `value.length` 字符判定改 `Buffer.byteLength` 字节判定）；总量 `MAX_PROJECTION_METADATA_BYTES` 16MB→32MB。
  - **验证**：新回归测试 `conversations.test.ts`「全量 rough(150k)≫真实 usage(1200) 时锚定 usage」（断言 totalTokens=1200/percentage=1/rawMax=200000）——stash 旧码 fail 钉住改动；src/server 4 家族 **488/488 绿**；tsc scoped 仅 TS5102 baseUrl 无害。
  - **patch**：`context-usage-anchor.patch`（4 文件 166 行）新增表行 21，h5-gzip 顺延 22；**22 链 fresh worktree@068b3ebd 顺序 apply FAIL=0，章十九 4 文件逐字节=工作树**。
  - **文档**：十九章 ⬜→✅ 回填实施+验证，两表 ⬜→✅，链规模 21→22。
- **十八章至本轮之间的既提交链**（WORK-HANDOFF 此前未覆盖）：`2d007b1a`/`ca4fc6c1`（#83 测试失败清零：1 真回归+3 环境泄漏+flaky 兜底 → server 全量 3442 零失败）→ `26375d8f`/`7f58a8f1`（二十 H5 远端 API gzip 压缩传输，省 68% 带宽，`h5-gzip-transport.patch`）→ `966ca8f1`/`7031e051`/`7062daaa`/`352e5241`/`297e9ea4`（二十二 TPS 展示改造+格式 "TPS XXXt/s"+4 位封顶 9999，`tps-indicator.patch` 重生成 8 文件 839 行，21 链验证）。

## 上一章状态（2026-09-26 14:00，task#81 上游融合）
- **本轮完成（task#81）**：上游 main `068b3ebd`（09-25，20 commit：pending 问题超时自动回答/聊天外观偏好/CORS 门控重做/OAuth 2.1.281/agent-teams/Kimi K3 图片透传等）融入 custom-066 + 19 patch 全部重基到 068b3ebd。
  - 提交链：a973e578 → `4e25e022`(merge 上游, 5 冲突全并集解决) → `005684ea`(修两处合并吞行+autoQuestion GET 测试期望) → `dbaa10b8`(MessagePayloadRetention 注释对齐上游) → `638c9bca`(AppShell 测试修复+19 patch 重基) → `50e0423f`(docs)。
  - **AppShell 既有回归修复**：chatStore mock 缺 `getSubordinateTpsMeters`（TPS 子代理汇聚引入）→ 补 `() => []`，22/22。
  - **19 patch 重基法（overlay 终态法）**：worktree@068b3ebd 每章 cp 终态文件→commit→相邻章 diff 出 patch。（2026-09-28：原先 h5-settings-whitelist / h5-mobile-market 两个空补丁**已移除**，链 59→57，此后按序 `git apply` **无需 `--allow-empty`**。）
  - **验证**：fresh worktree@068b3ebd 顺序 apply 19/19 全干净，终态 vs 工作树为**非章 delta**（截至 2026-09-28 实测 **19 个文件 / +36 −203 行**，含 package.json / preview-agent.js / providerModels.ts / TerminalSettings.tsx / modelEnv.ts / PermissionUpdate.ts 等；清单与来源见优化文档）。desktop tsc 0；desktop vitest 12456/2（2=MessageList 一条负载 flaky，隔离 201/201 绿）；server 6854/10（全 flaky，隔离全绿）。
- **桌面应用已编译**（合并前源码，符合「先编译当前版本」）：`desktop/build-artifacts/electron/` deb(201MB)+AppImage(253MB)+linux-unpacked，bundle App-C1OyVXUg.js（含 TPS 汇聚徽章，无上游新功能）。

## patch 体系（**60 链**，**基线 068b3ebd**）

> **2026-09-28 补齐**：二十七章原先「只登记不产补丁」，现已补成 **链位 58–60**（`chapter-27-test-env-isolation` / `chapter-27-vcc-calibration-scripts` / `chapter-27-residual-hunks`）。
> **复现度已达 100%**：干净 worktree@`068b3ebd` 按 1→60 依次 `git apply --index` **60/60 成功**；终态与工作树差异**仅剩 2 个有意排除项**——`bun.lock`（锁文件）与 `desktop/src-tauri/resources/preview-agent.js`（构建产物）。

顺序（自上而下 `git apply`，**无需 `--allow-empty`**）：h5-require-token → h5-auto-mode-optin → session-export → h5-settings-parity → h5-terminal-bridge → session-refresh → tps-indicator → file-download → disable-updates → cache-billing → thinking-switch → server-test-baseline-zeroing → h5-mobile-quick-actions → vcc-compactor → h5-mobile-scheduled → connector-linux-platform → h5-mobile-market-layout → computer-use-linux-x11 → context-usage-anchor（#85 十九）→ h5-gzip-transport（二十）→ **thinking-tool-timing**（#91 二十一，末位）。

## 工作树未提交项（预期内，非章 delta）

- untracked `.js` 孪生已清（本轮删 App-BfpbdBXT.js + site/src 11 个 .js 孪生遮蔽 .jsx）
- 树级 delta vs 23 链终态：#83 测试修复族（conversations/sessions/contextBudget 等 4 家族已随十九提交，余为 desktop/src 侧）+ 既有 bun.lock/TerminalSettings.tsx/providerModels.ts

## 待办

- ~~task #78：十八章 Computer Use Linux 门控放宽+状态页~~ ✅ 已完成
- ~~task #75：实施 linux_helper（X11 像素面）~~ ✅ 已完成
- ~~#85：bc 压缩后 context usage 不收敛（十九）~~ ✅ 已完成（94c8f0f7 + fa366de7，22 链验证）
- ~~**第二十一章**（思考计时综合优化）~~ ✅ 已完成（ef8801e3，23 链验证，deb 重编 22:44）
- **第二十三章**（子代理内容实时反馈 opencode 式）——已登记 ⬜ 待办仅记录，暂不推进
- **#89 诊断降级 62/63**（in_progress，独立优化项，与十九 WIP 文件不相交）
- **#88 computer use 环境组件**（in_progress）
- H5 市场显示 6 问题清单（已调研未实施，等用户圈范围）
- 可选后续：Linux 桌面端（非 H5）Computer Use 设置页 live 走一遍 Python 安装流（venv 建+依赖装）端到端；合并后如需重新出桌面包：`cd desktop && bun run electron:package`（产物落 build-artifacts/electron/）

## 环境速记

- dev 7788 运行中；H5 token `h5_H7kDPNb-KkhMnULdmQ-B0eoAd8ey-Pcc9PhtcpbeSUQ`
- 文档：`modify/cc-haha自定义优化-0.6.6重实现.md`（Patch 清单已重基到 068b3ebd，含应用法说明）
- 上游 remote：cchaha-06scode 的 origin 指向 /home/zeaxion/myproject/cc-haha；refs/upstream/main=068b3ebd
