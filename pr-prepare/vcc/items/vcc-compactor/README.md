# vcc-compactor — pi-vcc 算法压缩 + vcc_recall 工具（原链位 14,40）

> 功能主题：`vcc` — vcc 算法压缩（`pr-prepare/vcc/`）｜ PR 分支 `vcc-compaction`
> **单一真相源 patch**：`modify/patches/vcc/vcc-compactor-patch1.patch`（48 文件 +5794−35）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 14 | `vcc-compactor` | 十三 pi-vcc 算法压缩移植 + 双后端热切换 + vcc_recall |
| 40 | `vcc-compact-fallback` | 十三 vcc 失败降级兜底（抛错/空摘要 → 回落既有 LLM 摘要路径，避免自动压缩熔断静默停摆） |

## 明细

### 原链位 14 — `vcc-compactor`

- **需求背景**：现有 `/compact` 与 auto-compact 全走 LLM 摘要（`streamCompactSummary`，一轮完整模型调用），token 成本 + 延迟高，且摘要有丢失 / 幻觉风险。用户拍板范围 = 核心压缩 + recall 工具 + 双后端 UI；挂接 = 旁路摘要步、可切换后端；默认算法压缩接管全部，且**运行中可热切换**。本 patch 同时收编了两个后续子优化：
  - **局部压缩接入 vcc（片段模式）**：`partialCompactConversation` 原本只调 `streamCompactSummary`，后端为 algorithm 时带 pivot 的局部压缩仍走 LLM（静默偏差）。方案 C 新增 `runVccSliceCompaction()`：片段模式写在自有适配器、vendor 一行未动；只 compile 不切保留尾（`messagesToKeep: []` 恒定，边界由 pivot 决定）；`SLICE_OMITTED_SECTIONS = ['Session Goal','User Preferences']`（半段对话编不出「会话级」结论，缺失优于撒谎）。
  - **摘要召回提升 + 测量口径修正**：先修三个测量口径缺陷（judge `max_tokens` 1500→32768 防截断少报；样本钉住 `vcc-slice-judge.sample.json` 防随会话增长漂移；切片改按字符 `--slice-chars` 默认 750k，与生产口径对齐——自动压缩阈值 418,200 tok ≈ 170 万字符），再动两处 vendor 参数（均带 `LOCAL EDIT (cc-haha)` 标记）：`Modified`/`Created` 每类封顶 10→36（`Read` 保持 10），brief ceiling 2000→2500（惰性）。同时修掉两个实现自身缺陷：`omitSections` 按 `---` 切块误丢整段块（文件召回 83.7%→59.6%→修复回 83.7%）、继承引用指向片段外（`stripRefsOutside()`，正确处理多引用 `(#13, #14)`，4→0）。
- **方案**（要点）：
  1. **算法核心** `src/services/compact/vcc/`：逐字 vendor pi-vcc 0.8.0（`vendor/core/` 的 summarize/brief/build-sections/format/rank/search-entries(BM25-lite)/global-indices/jsonl 等 38 个 .ts + `vendor/extract/`）；适配层（非 vendor）：`adapter.ts`、`ccGlobalIndex.ts`（`#N` 跨压缩稳定）、`vccCompact.ts`（`runVccCompaction` / `runVccSliceCompaction` 入口）、`recallLoader.ts`、`recallDrillDown.ts`（full cap 50KB / preview 30 行）。
  2. **vcc_recall 工具** `src/tools/VccRecallTool/`：query / drill-down（`#N:path:full`）/ touched / expand / page 五模式，`PAGE_SIZE=5`、只读；`src/tools.ts` 注册（无 feature gate，工具计数 36→37）。
  3. **双后端设置链**（8 步）：`vccCompactBackend='algorithm'|'llm'` 默认 algorithm；`compactionBackend.ts` 热切换（compaction 时实时读设置）；settings 类型 + desktop 5 处 + i18n 5 语言 + `remoteBrowserPolicy.ts` READ/WRITE 白名单（H5 必须同步否则 PUT 400）。
  4. **旁路接线** `compact.ts`：新增 `maybeVccCompact` / `maybeVccSliceCompact`（抛错 / 空摘要双降级走 LLM 回退、abort 上抛），VCC 命中时跳过 LLM 循环；`logEvent('tengu_compact')` 加 `compactionBackend` 字段。
- **验证**：单测 `VccRecallTool.test.ts` 10/10、`remoteBrowserPolicy.test.ts` 4/4、`bun test src/services/compact` 30 pass/0 fail；前端 vitest 12300+/0 fail 零回归；runtime probe 验证 5 section 编译 + 保 tail + merge 去重。语料校准（240 场景，750k 切片，default 变体）：mean file-recall **87.1%** / median **88.9%** / 改动文件 **97.0%**、杜撰 0、不可解析引用 0、越出片段引用 0、策略违规 0——落入用户目标 87–93%。引擎裁判（8 例抽样）coverage 2.88 / readability 3.62，遗留主缺口在 vendor brief 选材（工具行优先于助手结论），已按用户裁决带标记改 vendor 后停在此处。

### 原链位 40 — `vcc-compact-fallback`

- **需求背景**：此前 vcc 路径无兜底且后果比 LLM 路径严重——手动压缩失败尚可接受，但**自动**压缩抛错会被 `autoCompact.ts` 计入 `consecutiveFailures`，`MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3` 熔断后**本会话不再压缩**，上下文一路涨到硬上限才撞 prompt-too-long，属静默失效。vcc 是从 pi-vcc 移植的 vendor 代码，「遇到没见过的消息形状抛 TypeError」正是移植代码的典型失效模式（实测 `{type:'user', uuid:'u1'}` 缺 `.message` 当场抛 TypeError），低概率 × 高严重性 → 值得兜。
- **方案**（约 15 行，只改 `src/services/compact/compact.ts`）：`maybeVccCompact` 末尾包 try/catch，失败**返回 `null`**——正好走既有设计内回退（调用方 `for (;;) { if (vccResult) break }` 不 break → 执行 `streamCompactSummary`），无需新机制：
  1. 抛异常 → `logError` + `logEvent('tengu_compact_failed', {reason:'vcc_threw'})` → 返回 null；
  2. 用户中断（`ERROR_MESSAGE_USER_ABORT`）原样上抛（吞掉会让用户中断失效）；
  3. 跑完但摘要为空 → `{reason:'vcc_empty_summary'}` → 返回 null（LLM 路径有 `if (!summary) throw` 守着，vcc 不能更弱——空摘要会用空白边界替换整段上下文却报告成功）；
  4. 遥测自动正确：`compactionBackend` 如实记成 `llm`。
  `maybeVccCompact` 为可测从模块私有导出。
- **验证**：`bun test src/services/compact` 20 pass/0 fail（新增 3 条：抛错返回 null / abort 上抛 / 空窗口摘要为空且返回 null，触发用真实 TypeError 而非 mock）；策略 72 pass/0 fail；服务端 `tsc --noEmit` 0 错。
