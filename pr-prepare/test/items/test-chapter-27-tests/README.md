# test-chapter-27-tests — 章二十七测试隔离与残余 hunk（原链位 58,60）

> 功能主题：`test` — 测试环境隔离与基线修复（`pr-prepare/test/`）｜ PR 分支 `test-baseline`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/test/test-chapter-27-tests-patch1.patch`（18 文件 +180−28）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 58 | `chapter-27-test-env-isolation` | 二十七 27.1：**测试环境隔离与遗留失败清零**——新增 `src/testUtils/modelEnv.ts`（`isolateModelDefaultsEnv()` 存/剥离/还原模型相关 env），并接入 12 个用例（模型 4 个 + `effort.agent` + `thinking` + `print.sessionMessage` + `client` + `computerUse` + `builtInAgentOverrides` + `system` + `coreSchemas.modelInfo`）。根因＝**桌面 dev 会把 `CLAUDE_CODE_*` 导出进进程**，致同一批用例**单跑失败、官方 runner 全绿**——是环境泄漏不是真缺陷（13 文件） |
| 60 | `chapter-27-residual-hunks` | 二十七 27.3：**章内残余 hunk**——`api/claude.ts` bound-thinking 模型（Fable 5.1）需回放思考块（`modelUsesBoundThinking`，剥离会破坏 system 变更后的重放）；`providerModels` 排序固定 `'en'`（宿主 zh 会把 CJK 排到拉丁之前，「其他」组顶到真实 provider 名之上）；`TerminalSettings` 的 `createTerminalRequestId()` 在非安全上下文（H5 经 LAN IP）无 `crypto.randomUUID` 故回退时间戳+随机串；`package.json` 去掉与 `build`/`tsc -b` 口径重复的两个脚本；`PermissionUpdate` require 环改 **Proxy getter**（顶层 require 在环中拿到的是空命名空间且会一直返回它）。与 58/59 合计补齐 21 个「无补丁触及」的文件（5 文件） |

## 明细

### 原链位 58 — `chapter-27-test-env-isolation`

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

### 原链位 60 — `chapter-27-residual-hunks`

- **需求背景**：章节提交里有数个 hunk 从未被任何 patch 捕获（「基线 + 全链」无法 100% 复现工作树的差额之一）。其中核心是 bound-thinking 功能：Fable 5.1 等 bound-thinking 模型需在请求里回放思考块，让 API 按前缀丢弃旧的绑定块——若剥离，会破坏 system 变更后的重放。
- **方案**：
  - `src/services/api/claude.ts`：补 `modelUsesBoundThinking(options.model)` 判定及思考块回放逻辑（源自 `39bd52b5` / `ef8801e3` / `6d4fd126` / `4e25e022` 多个提交）；`thinking.test.ts` 补对应用例。
  - `desktop/src/lib/providerModels.ts`：排序显式固定 `localeCompare(..., 'en', ...)`——不传 locale 时按宿主区域，中文环境下 CJK 排到拉丁之前，会把「其他」兜底组顶到真实 provider 名之上。
  - `desktop/src/pages/TerminalSettings.tsx`：`createTerminalRequestId()` 中 `crypto.randomUUID` 仅安全上下文可用，H5 经 LAN IP 访问（非安全上下文）会抛错 ⇒ 回退时间戳+随机串（镜像 `McpSettings` 做法）。
  - `desktop/package.json`：移除 `build:renderer`（与 `build` 重复）、`typecheck`（与本仓 `tsc -b` 口径不一致）两个脚本。
  - `src/utils/permissions/PermissionUpdate.ts`：require 环改 Proxy getter（顶层 require 在环中拿到空命名空间且会一直返回它）。
- **验证**：干净 worktree@`068b3ebd` 按链序 apply 58/59/60 后，终态与工作树差异仅剩 2 个有意排除项（`bun.lock`、`preview-agent.js`）；deb 产物核验 `providerModels` 固定 `'en'` 与 `TerminalSettings` 回退逻辑均已进包。
- **权威口径 = `bun run check:server`**：官方 runner 逐文件独立进程 + env 白名单，对宿主 env 泄漏免疫（全 src 逐文件 + 剥 env，本仓实测 492 文件 / 5928 条全绿）。
- **坑：不要用 `bun test src` 整目录跑**——`mock.module` 泄漏 + `mock.restore()` 无效 + ambient env，会产生「假红」（如 `bun test src/utils` 整目录 34 条失败但非真缺陷）。整目录失败时优先怀疑环境而非代码，单文件/单用例复跑或走官方 runner 对照。
- 本组改动基本是测试侧 + 少量代码侧（`workspaceService`/`sessionService`/`claude.ts` 等），回归以 `bun test src/server` 全量（3396/0/0）+ `bun run check:server` 为准。
- **pr-7 的 27.2（vcc 校准脚本，链位 59）属另一组**：`scripts/vcc-slice-calibration.ts` / `vcc-slice-judge.ts` 是 vcc 片段模式的**测量工具**（语料校准与判分），非产品代码，且配套 `.gitignore` 排除机器生成报告；与本组无共享文件（58/59/60 三者互相独立、也不与链 1–57 共享文件，可在任何位置应用）。
- 链位 12 与 47/58 同属「测试基线」主题但层次不同：12 修的是 `src/server` 的既有真失败（含 4 处代码修复），47/58 修的是 env 泄漏假红并沉淀 `modelEnv.ts` 工具；12 的 ambient env 簇（5 条）与 58 的隔离思路一脉相承但接入范围不同。
- 链位 60 的 `api/claude.ts` bound-thinking hunk 与章八/二十一（思考相关 PR）主题相邻，但按「章内残余 hunk」归入本组补齐链完整性。
- ⚠️ **上游冲突风险文件**（上游 main 也改过，PR 合入时需三方合并/冲突处理）：
  - `src/services/api/claude.ts`（链位 60 bound-thinking，且 27.3 注明它是「待办性质」：章八/二十一补丁重生成时未包含，上游若合入思考相关改动此处最易撞）
  - `desktop/package.json`（链位 60 删脚本；上游若加脚本会撞）
  - `src/server/__tests__/conversation-service.test.ts`、`src/server/services/sessionCollaborationService.ts`（链位 12）
- `modelEnv.ts` 及其 12 个用例接入是**新增文件/纯测试改动**，冲突面小；但接入清单较长，上游若在这些 `*.test.ts` 上有大改需逐一核对接入点是否存活。
- 链位 12 含 4 处**代码**修复（`workspaceService` git 探针、`sessionService` mtime-only 排序、`sessionCollaborationService` 游标、whatsapp 动态 import）——PR 描述需明确这些是「修基线既有 bug」而非测试豁免，否则上游 reviewer 可能质疑为何改产品代码。
- 文档 27.4 复核口径提醒：比对补丁是否完整须用 `git apply --index`（不加 `--index` 时新增文件是未跟踪状态，`git diff <commit>` 看不见，会误报成删除）。
