# 40-vcc-compact-fallback — vcc 失败降级兜底（链位 40，`40-vcc-compact-fallback.patch`，+217/−10，2 文件）

> 功能组：pr-7 — vcc 算法压缩（pi-vcc 移植 + 窗口分档 + 降级兜底 + 校准脚本）（pr-prepare/pr-7/）
> 链位 40，patch `40-vcc-compact-fallback.patch`（本目录）

- **需求背景**：此前 vcc 路径无兜底且后果比 LLM 路径严重——手动压缩失败尚可接受，但**自动**压缩抛错会被 `autoCompact.ts` 计入 `consecutiveFailures`，`MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3` 熔断后**本会话不再压缩**，上下文一路涨到硬上限才撞 prompt-too-long，属静默失效。vcc 是从 pi-vcc 移植的 vendor 代码，「遇到没见过的消息形状抛 TypeError」正是移植代码的典型失效模式（实测 `{type:'user', uuid:'u1'}` 缺 `.message` 当场抛 TypeError），低概率 × 高严重性 → 值得兜。
- **方案**（约 15 行，只改 `src/services/compact/compact.ts`）：`maybeVccCompact` 末尾包 try/catch，失败**返回 `null`**——正好走既有设计内回退（调用方 `for (;;) { if (vccResult) break }` 不 break → 执行 `streamCompactSummary`），无需新机制：
  1. 抛异常 → `logError` + `logEvent('tengu_compact_failed', {reason:'vcc_threw'})` → 返回 null；
  2. 用户中断（`ERROR_MESSAGE_USER_ABORT`）原样上抛（吞掉会让用户中断失效）；
  3. 跑完但摘要为空 → `{reason:'vcc_empty_summary'}` → 返回 null（LLM 路径有 `if (!summary) throw` 守着，vcc 不能更弱——空摘要会用空白边界替换整段上下文却报告成功）；
  4. 遥测自动正确：`compactionBackend` 如实记成 `llm`。
  `maybeVccCompact` 为可测从模块私有导出。
- **验证**：`bun test src/services/compact` 20 pass/0 fail（新增 3 条：抛错返回 null / abort 上抛 / 空窗口摘要为空且返回 null，触发用真实 TypeError 而非 mock）；策略 72 pass/0 fail；服务端 `tsc --noEmit` 0 错。
