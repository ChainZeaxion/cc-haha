# 58-chapter-27-test-env-isolation — 测试环境隔离工具与遗留失败清零（链位 58，`58-chapter-27-test-env-isolation.patch`，13 文件 +147/−22）

> 功能组：pr-6 — 测试环境隔离与基线修复（pr-prepare/pr-6/）
> 链位 58，patch `58-chapter-27-test-env-isolation.patch`（本目录）

- **需求背景**：链位 12 的清零之后（以及工作树演进中），又发现一批用例对桌面 dev env 泄漏的 `CLAUDE_CODE_*` 敏感——同一批用例单跑失败、`bun run check:server` 官方 runner 全绿。此前这类修复散落在多个 commit（`ca4fc6c1` / `2d007b1a` / `1df6bf70`）未纳入章节链，需统一补成补丁并固化隔离工具。
- **方案**：
  - 新增 `src/testUtils/modelEnv.ts`：导出 `isolateModelDefaultsEnv()`（保存/剥离/还原模型相关 env），供各用例 `beforeEach` 调用。
  - 接入 12 个 env 敏感用例：`src/utils/model/{agent,fable,opus5,opus55}.test.ts`、`effort.agent.test.ts`、`__tests__/thinking.test.ts`、`print.sessionMessage.test.ts`、`api/client.test.ts`、`computerUse.test.ts`、`builtInAgentOverrides.test.ts`、`constants/system.test.ts`、`coreSchemas.modelInfo.test.ts` 等（覆盖 `CLAUDE_CODE_ATTRIBUTION_HEADER` / `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` 等继承 env 污染）。
  - 另清掉「1 真回归 + 3 环境泄漏 + 1 flaky 兜底」的遗留失败。
- **验证**：接入后各用例在污染 env 下单跑与官方 runner 结果一致；`bun run check:server` 全绿（5928 条）。⚠️ 文档 27.1 明确：`modelEnv.ts` 及其接入**不在早期链位 12 的补丁里**（12 只含其中一部分），补链后以本补丁为准。
### 4. 章内残余 hunk（bound-thinking 回放等，链位 60，`60-chapter-27-residual-hunks.patch`，5 文件 +33/−6）
- **需求背景**：章节提交里有数个 hunk 从未被任何 patch 捕获（「基线 + 全链」无法 100% 复现工作树的差额之一）。其中核心是 bound-thinking 功能：Fable 5.1 等 bound-thinking 模型需在请求里回放思考块，让 API 按前缀丢弃旧的绑定块——若剥离，会破坏 system 变更后的重放。
- **方案**：
  - `src/services/api/claude.ts`：补 `modelUsesBoundThinking(options.model)` 判定及思考块回放逻辑（源自 `39bd52b5` / `ef8801e3` / `6d4fd126` / `4e25e022` 多个提交）；`thinking.test.ts` 补对应用例。
  - `desktop/src/lib/providerModels.ts`：排序显式固定 `localeCompare(..., 'en', ...)`——不传 locale 时按宿主区域，中文环境下 CJK 排到拉丁之前，会把「其他」兜底组顶到真实 provider 名之上。
  - `desktop/src/pages/TerminalSettings.tsx`：`createTerminalRequestId()` 中 `crypto.randomUUID` 仅安全上下文可用，H5 经 LAN IP 访问（非安全上下文）会抛错 ⇒ 回退时间戳+随机串（镜像 `McpSettings` 做法）。
  - `desktop/package.json`：移除 `build:renderer`（与 `build` 重复）、`typecheck`（与本仓 `tsc -b` 口径不一致）两个脚本。
  - `src/utils/permissions/PermissionUpdate.ts`：require 环改 Proxy getter（顶层 require 在环中拿到空命名空间且会一直返回它）。
- **验证**：干净 worktree@`068b3ebd` 按链序 apply 58/59/60 后，终态与工作树差异仅剩 2 个有意排除项（`bun.lock`、`preview-agent.js`）；deb 产物核验 `providerModels` 固定 `'en'` 与 `TerminalSettings` 回退逻辑均已进包。
