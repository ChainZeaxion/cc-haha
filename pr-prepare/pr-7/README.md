# pr-7 — vcc 算法压缩（pi-vcc 移植 + 窗口分档 + 降级兜底 + 校准脚本）

> 建议分支：`pr/vcc-compaction`
> 上游文档章节：十三 / 二十四 / 二十七.2（`modify/cc-haha自定义优化-0.6.6重实现.md`）

## 功能域概述

本组把 [pi-vcc](https://github.com/sting8k/pi-vcc)（"Algorithmic conversation compactor — transcript-preserving structured summaries, no LLM calls"，0.8.0）完整移植进 cc-haha：用**纯算法**（零 LLM 调用）替代现有 `/compact` 与 auto-compact 的 LLM 摘要路径，编译出 5 个语义 section + brief transcript，被压缩的原始细节依赖既有 session JSONL 持久化、由新增 `vcc_recall` 工具按全局 message index（`#N`）无损检索回读。配套提供：压缩阈值按上下文窗口分档（软触发百分比 + 硬触发绝对下限）、vcc 失败时回落既有 LLM 摘要路径的降级兜底，以及 vcc 片段模式的语料校准 / 引擎判分脚本。默认后端为 algorithm，设置中可切换、运行中可热切换。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. pi-vcc 算法压缩移植 + 双后端热切换 + vcc_recall 工具（链位 14，`14-vcc-compactor.patch`，+5584/−32，47 文件）

- **需求背景**：现有 `/compact` 与 auto-compact 全走 LLM 摘要（`streamCompactSummary`，一轮完整模型调用），token 成本 + 延迟高，且摘要有丢失 / 幻觉风险。用户拍板范围 = 核心压缩 + recall 工具 + 双后端 UI；挂接 = 旁路摘要步、可切换后端；默认算法压缩接管全部，且**运行中可热切换**。本 patch 同时收编了两个后续子优化：
  - **局部压缩接入 vcc（片段模式）**：`partialCompactConversation` 原本只调 `streamCompactSummary`，后端为 algorithm 时带 pivot 的局部压缩仍走 LLM（静默偏差）。方案 C 新增 `runVccSliceCompaction()`：片段模式写在自有适配器、vendor 一行未动；只 compile 不切保留尾（`messagesToKeep: []` 恒定，边界由 pivot 决定）；`SLICE_OMITTED_SECTIONS = ['Session Goal','User Preferences']`（半段对话编不出「会话级」结论，缺失优于撒谎）。
  - **摘要召回提升 + 测量口径修正**：先修三个测量口径缺陷（judge `max_tokens` 1500→32768 防截断少报；样本钉住 `vcc-slice-judge.sample.json` 防随会话增长漂移；切片改按字符 `--slice-chars` 默认 750k，与生产口径对齐——自动压缩阈值 418,200 tok ≈ 170 万字符），再动两处 vendor 参数（均带 `LOCAL EDIT (cc-haha)` 标记）：`Modified`/`Created` 每类封顶 10→36（`Read` 保持 10），brief ceiling 2000→2500（惰性）。同时修掉两个实现自身缺陷：`omitSections` 按 `---` 切块误丢整段块（文件召回 83.7%→59.6%→修复回 83.7%）、继承引用指向片段外（`stripRefsOutside()`，正确处理多引用 `(#13, #14)`，4→0）。
- **方案**（要点）：
  1. **算法核心** `src/services/compact/vcc/`：逐字 vendor pi-vcc 0.8.0（`vendor/core/` 的 summarize/brief/build-sections/format/rank/search-entries(BM25-lite)/global-indices/jsonl 等 38 个 .ts + `vendor/extract/`）；适配层（非 vendor）：`adapter.ts`、`ccGlobalIndex.ts`（`#N` 跨压缩稳定）、`vccCompact.ts`（`runVccCompaction` / `runVccSliceCompaction` 入口）、`recallLoader.ts`、`recallDrillDown.ts`（full cap 50KB / preview 30 行）。
  2. **vcc_recall 工具** `src/tools/VccRecallTool/`：query / drill-down（`#N:path:full`）/ touched / expand / page 五模式，`PAGE_SIZE=5`、只读；`src/tools.ts` 注册（无 feature gate，工具计数 36→37）。
  3. **双后端设置链**（8 步）：`vccCompactBackend='algorithm'|'llm'` 默认 algorithm；`compactionBackend.ts` 热切换（compaction 时实时读设置）；settings 类型 + desktop 5 处 + i18n 5 语言 + `remoteBrowserPolicy.ts` READ/WRITE 白名单（H5 必须同步否则 PUT 400）。
  4. **旁路接线** `compact.ts`：新增 `maybeVccCompact` / `maybeVccSliceCompact`（抛错 / 空摘要双降级走 LLM 回退、abort 上抛），VCC 命中时跳过 LLM 循环；`logEvent('tengu_compact')` 加 `compactionBackend` 字段。
- **验证**：单测 `VccRecallTool.test.ts` 10/10、`remoteBrowserPolicy.test.ts` 4/4、`bun test src/services/compact` 30 pass/0 fail；前端 vitest 12300+/0 fail 零回归；runtime probe 验证 5 section 编译 + 保 tail + merge 去重。语料校准（240 场景，750k 切片，default 变体）：mean file-recall **87.1%** / median **88.9%** / 改动文件 **97.0%**、杜撰 0、不可解析引用 0、越出片段引用 0、策略违规 0——落入用户目标 87–93%。引擎裁判（8 例抽样）coverage 2.88 / readability 3.62，遗留主缺口在 vendor brief 选材（工具行优先于助手结论），已按用户裁决带标记改 vendor 后停在此处。

### 2. 上下文压缩阈值按窗口分档（链位 22，`22-autocompact-window-tiers.patch`，+144/−26，2 文件）

- **需求背景**：`autoCompact.ts` 的缓冲 `AUTOCOMPACT_BUFFER_TOKENS` 固定 13K、与窗口大小无关——512K 窗口下仅剩 ~2.5% 才触发（太晚），32K 小窗口下 13K=41%（靠 `cap` 到 `window/3` 兜底，语义含糊）。用户要求按窗口分档设定软触发（剩余百分比）与硬触发（剩余绝对量）。
- **方案**（要点）：
  - 5 档分档表 `AUTOCOMPACT_TIERS`：≤100K 13%/<13K、≤200K 17%/<32K、≤300K 21%/<36K、≤500K 17%/<53K（用户定稿）、≥500K 15%/<65K。
  - 三个口径：分档键 = **声明窗口**（`getResolvedContextWindow()` 新增，不扣摘要预留）；阈值算在**有效窗口**（已扣预留）；硬触发 `getForcedCompactThreshold()` 算在声明窗口，并以 `max(..., 软)` 钳制保证永不早于软触发。
  - 小窗口安全钳制：软阈值取 `min(档位阈值, window − min(13K, window/3))`，小窗口阈值与旧实现逐字节一致（8K/16K/16.5K/35K/47K），零回归。
  - `calculateTokenWarningState()` 新增 `isAtForcedCompactLimit` 出口；`percentLeft` 分母由 threshold 改为有效窗口（原实现到压缩点显示 0%，与「剩 13%」语义相悖）；`shouldAutoCompact()` 触发条件改为软 ∥ 硬。
- **验证**：`bun test src/services/compact/` 17/17 通过（含 12 个 autoCompact 用例 + 新增分档专项用例）；`analyzeContext` + `inProcessRunner` 25/25；`tsc --noEmit` 改动文件 0 错；小窗口 5 个用例（16K/32K/33K/64K/80K）未改动即通过，证明安全钳制保住原行为。换算表已在文档中按 8 个模型逐一核对（如 1M 窗口：软 833,000 / 硬 935,000）。

### 3. 策略门禁 dead-imports 清零（链位 36，`36-compact-dead-import-cleanup.patch`，+1/−3，3 文件）

- **需求背景**：`check:policy` 的 dead-imports 规则因十三章 vcc 移植遗留的 3 处未引用导入一直红：`compact.ts` 的 `isEnvTruthy`、`vcc/vendor/core/build-sections.ts` 的 `clip`、`vcc/vendor/types.ts` 的 `Message`。该规则的既定口径是「删掉」而非加白名单。
- **方案**：删除这 3 处未引用导入，共 3 文件 3 行，无逻辑改动。
- **验证**：`check:policy`（dead-imports/module-graph/change-policy/changed-files）全绿；全链重放失败 0，3 文件逐字节等于工作树。

### 4. vcc 失败降级兜底（链位 40，`40-vcc-compact-fallback.patch`，+217/−10，2 文件）

- **需求背景**：此前 vcc 路径无兜底且后果比 LLM 路径严重——手动压缩失败尚可接受，但**自动**压缩抛错会被 `autoCompact.ts` 计入 `consecutiveFailures`，`MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3` 熔断后**本会话不再压缩**，上下文一路涨到硬上限才撞 prompt-too-long，属静默失效。vcc 是从 pi-vcc 移植的 vendor 代码，「遇到没见过的消息形状抛 TypeError」正是移植代码的典型失效模式（实测 `{type:'user', uuid:'u1'}` 缺 `.message` 当场抛 TypeError），低概率 × 高严重性 → 值得兜。
- **方案**（约 15 行，只改 `src/services/compact/compact.ts`）：`maybeVccCompact` 末尾包 try/catch，失败**返回 `null`**——正好走既有设计内回退（调用方 `for (;;) { if (vccResult) break }` 不 break → 执行 `streamCompactSummary`），无需新机制：
  1. 抛异常 → `logError` + `logEvent('tengu_compact_failed', {reason:'vcc_threw'})` → 返回 null；
  2. 用户中断（`ERROR_MESSAGE_USER_ABORT`）原样上抛（吞掉会让用户中断失效）；
  3. 跑完但摘要为空 → `{reason:'vcc_empty_summary'}` → 返回 null（LLM 路径有 `if (!summary) throw` 守着，vcc 不能更弱——空摘要会用空白边界替换整段上下文却报告成功）；
  4. 遥测自动正确：`compactionBackend` 如实记成 `llm`。
  `maybeVccCompact` 为可测从模块私有导出。
- **验证**：`bun test src/services/compact` 20 pass/0 fail（新增 3 条：抛错返回 null / abort 上抛 / 空窗口摘要为空且返回 null，触发用真实 TypeError 而非 mock）；策略 72 pass/0 fail；服务端 `tsc --noEmit` 0 错。

### 5. vcc 片段模式校准 / 判分脚本（链位 59，`59-chapter-27-vcc-calibration-scripts.patch`，+1518/−0，3 文件）

- **需求背景**：vcc 片段模式（局部压缩接入）的摘要质量需要**可复现的离线测量**：确定性指标（文件召回、杜撰、引用可解析性、是否越出片段、压缩比、段清单、Bash 参数噪音）+ 引擎裁判。历轮结论反复推翻的根因全是测量口径（`max_tokens` 截断、抽样漂移、切片尺寸差 12 倍），脚本把这些口径钉死后才能动参数。脚本属**测量工具**而非产品代码，此前只在「二十七章登记」未入链。
- **方案**（要点）：
  - `scripts/vcc-slice-calibration.ts`（1076 行）：语料 = `~/.claude/projects` 顶层会话，`bun run scripts/vcc-slice-calibration.ts --max 20`（20 会话/240 场景）；`--slice-chars` 默认 750000（切片尺寸必须与分数同报，且贴近生产口径）；裁判 `max_tokens=32768`、样本钉到 `vcc-slice-judge.sample.json`（`--resample` 才重抽）、judge `temperature:0`。
  - `scripts/vcc-slice-judge.ts`（439 行）：让引擎读同一片段评判摘要的覆盖/杜撰/误导/可读性，输出结构化 JSON；默认不嵌「summary under review」（`--embed-summaries` 才开，防语料外泄）。
  - `.gitignore`：排除**机器生成的报告**（机器输出含每个场景的摘要全文、引用会话原文，不入库；入库的是手写版报告）。
- **验证**：脚本产出的校准指标即优化项 1 的验收数据（240 场景 87.1%/88.9%/97.0%）；8 例引擎裁判 coverage 2.88 / readability 3.62；补丁 59 与链 1–57 相互独立（无人共享文件），可在任何位置应用。

## 验证口径（组级）

- **单测**：`bun test src/services/compact`（autoCompact/compact/vccCompact/VccRecallTool 各套）全过；`check:policy` 全绿。
- **全量零回归**：前端 `desktop vitest` 12300+ pass / 0 fail；server `bun test` 全量仅剩 VCC 未触碰的 proxy/端口竞态 flaky 族（单文件复跑全过）。
- **链重放**：本组 5 个 patch 在干净基线 `068b3ebd` worktree 上按链序 `git apply --index` 成功，涉及文件逐字节等于工作树。
- **语料校准（生产口径）**：240 场景 × 750k 切片，官方口径 mean file-recall 87.1% / median 88.9% / 改动文件 97.0%，杜撰 0、不可解析引用 0、越出片段引用 0、策略违规 0；对照 `none` 变体严格更优。
- ⚠️ 局部压缩（`partialCompactConversation`）**无自动化端到端**：唯一入口是 CLI REPL 的消息选择器回调，`streamCompactSummary` 为模块内私有函数无法 `mock.module` 替换——验收证据 = 单元级 + 离线语料校准（已知边界，如实登记）。

## 与其他组的关系

- **与 pr-6 部分交织**：pr-6（测试基线/隔离类）的 `bun run check:server` 官方 runner + env 白名单（对应二十七.1 的 27.1 测试环境隔离）为本组的测试结论提供口径基础——本组多项「全量零回归」结论以该 runner 为权威口径；且 pr-6 的 `modelEnv.ts`/env 隔离接入与本组改动文件**不共享**（58–60 与链 1–57 无人共享文件，可任意位置应用），但验证顺序上建议 pr-6 先行，使本组 `bun test` 结果在干净环境口径下成立。
- 链位 59（校准脚本）与 pr-6 同属「二十七章」补齐产物（58/59/60 三位），本组只取 59（vcc 专属脚本），27.1（58）与 27.3（60）归 pr-6。

## 风险与备注

- **⚠️ 上游冲突风险文件**（manifest 标注「上游 main 也改过」）：
  - `src/services/compact/compact.test.ts`、`src/services/compact/compact.ts` —— 本组改动核心（旁路接线 + 降级兜底），上游若动 compact 主流程大概率冲突；
  - `src/tools.ts` —— 工具注册表，上游每加一个工具都动此文件（本组只改一行注册 + 计数）。
- **vcc 57 文件新子系统为最大新增块**：`src/services/compact/vcc/`（含 vendor）+ `src/tools/VccRecallTool/` 为全新目录树（vendor 38 个 .ts 逐字移植，顶部标 "Do not edit by hand"），对上游是净新增、冲突面小，但审查体量最大；其中**两处 vendor 内改动带 `LOCAL EDIT (cc-haha)` 标记**（`build-sections.ts` 封顶 10→36、`vccCompact.ts` ceiling 2500），需向评审者解释为何动 vendor。
- **SM-compact 岔路**：`autoCompact` 会先试 `trySessionMemoryCompaction`，成功则完全绕过 vcc；本 fork 中 GrowthBook key 恒空 → SM 恒关闭，故生产真走 vcc。上游若启用 SM，需确认两者优先级。
- **双计/引用固有歧义**：vcc 用 `(#N)` 渲染召回引用，与助手散文中的任务编号同形，摘要里两者无法区分（已知，未改）；校准脚本的引用正则会把任务编号误报为不可解析引用——单条 ref 告警不足以判回归。
- **已知质量缺口（如实登记，本组未改）**：`Commits` 段因适配器 `Bash`→`kind:"bash"` 不匹配 vendor 提取条件而 240/240 全缺；`Outstanding Context` 提取条件偏严（7/240）；`Files And Changes` 每类封顶 10 的长尾天花板（预算问题非策略问题）。
- **设置页依赖链**：双后端开关依赖 H5 `remoteBrowserPolicy.ts` READ/WRITE 白名单同步（否则 PUT 400 回弹）；本 manifest 的 `h5Access.ts`/`desktopRuntime.ts`/`GeneralSettings.tsx`/`settingsStore.ts`/`types/settings.ts` 等 5 个文件标为「依赖补齐」（链内被其他组改动/新增的传递依赖），PR 描述中需说明这部分 diff 非本组核心逻辑。
