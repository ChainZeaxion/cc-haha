# pr-6 — 测试环境隔离与基线修复

> 建议分支：`pr/test-baseline` · 上游文档章节：十二 / 二十七.1 / 二十七.3 · 4 个 patch（链位 12 / 47 / 58 / 60）

## 功能域概述

0.6.6 基座上 `src/server` 存在 22 条与本仓优化无关的既有测试失败，且桌面 dev 环境会把一批 `CLAUDE_CODE_*` 环境变量（如 `CLAUDE_CODE_MODEL_CONTEXT_WINDOWS`、`CLAUDE_CODE_ATTRIBUTION_HEADER=0`）导出进测试进程——同一批用例**单跑失败、官方 runner 全绿**，是环境泄漏而非真缺陷。本组把这些基线失败全部清零、建立「零失败」测试基线，并提供统一的模型 env 隔离工具（`isolateModelDefaultsEnv()`），使后续任何回归都能被立刻发现、单跑与官方 runner 结论一致。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. src/server 既有 22 条测试失败清零（链位 12，`12-server-test-baseline-zeroing.patch`，7 文件 +95/−16）

- **需求背景**：基线上 `bun test src/server` 存在 22 条既有失败（纯基线遗留，与本仓优化无关）。失败原因混杂（locale、env 泄漏、无界文件读、平台耦合等），若不先清零，后续任何真实回归都会被噪声淹没，无法立刻发现。
- **方案**：8 类根因分「修代码 4 + 修测试 4」处理——
  - git locale（7 条）：`workspaceService.ts` 移植退出码探针 `git rev-parse --is-inside-work-tree`，不再依赖英文 stderr 子串 `not a git repository`（中文 locale 输出 `不是 git 仓库` 致误判）；`runGit` 区分「git 没跑起来」vs「跑了但拒绝」。
  - ambient env 泄漏（5 条）：`conversation-service.test.ts` 补清 `EMIT_SESSION_STATE_EVENTS`/`FIRST_TOKEN_TIMEOUT_MS`；`full-flow.test.ts` 加 `TOKEN_ENV_KEYS` 保存/删除/恢复。
  - findSessionFile 无界全文读（4 条）：文件系统回退路径改 mtime-only 排序，仅同 id 有 ≥2 个候选文件时才做 transcript 偏好读。
  - 协作游标 depth 计数（1 条）：depth 仅在跨物理页时递增，同页 `end` 游标保持 depth。
  - 缺依赖 500（2 条）：`adapters/whatsapp/session.ts` 顶层静态 import 改动态 `import()`（懒加载），缺依赖只在真正 login 时失败。
  - 平台耦合（2 条）：connector 版本正则平台 token 放宽为 `[a-z]+`；workspaceWatch 测试等待各平台都会产生的 `a.ts`。
- **验证**：`bun test src/server` 全量 **3396 pass / 0 fail / 0 error**（22 条全清，零新增）；逐簇回归全绿（conversation-service 75/75、sessions 315/315、connector 24/24、h5-access-auth 53/53 等）；`desktop tsc -b` exit 0。

### 2. 三处模型 env 敏感用例接入 `isolateModelDefaultsEnv`（链位 47，`47-test-model-env-isolation.patch`，3 文件 +20/−0）

- **需求背景**：十二章清零后仍有补记：本机 dev 导出的 `CLAUDE_CODE_MODEL_CONTEXT_WINDOWS` 等变量泄漏进 `modelContextWindows`/`ultracode`/`processSlashCommand` 三组用例，**单跑也失败**；官方 runner 因逐文件独立进程 + env 白名单而免疫，两边结论不一致。
- **方案**：将 `modelContextWindows.test.ts`、`ultracode.test.ts`、`processSlashCommand.test.ts` 三处模型 env 敏感用例接入 `isolateModelDefaultsEnv()`（在 `beforeEach` 中保存/剥离/还原模型相关 env），消除宿主环境对这些用例的影响。
- **验证**：三组用例在带 `CLAUDE_CODE_MODEL_CONTEXT_WINDOWS` 等导出的 dev shell 下单跑全绿，与官方 runner 结论一致（3 文件 20 行新增，纯测试侧改动）。

### 3. 测试环境隔离工具与遗留失败清零（链位 58，`58-chapter-27-test-env-isolation.patch`，13 文件 +147/−22）

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

## 验证口径

- **权威口径 = `bun run check:server`**：官方 runner 逐文件独立进程 + env 白名单，对宿主 env 泄漏免疫（全 src 逐文件 + 剥 env，本仓实测 492 文件 / 5928 条全绿）。
- **坑：不要用 `bun test src` 整目录跑**——`mock.module` 泄漏 + `mock.restore()` 无效 + ambient env，会产生「假红」（如 `bun test src/utils` 整目录 34 条失败但非真缺陷）。整目录失败时优先怀疑环境而非代码，单文件/单用例复跑或走官方 runner 对照。
- 本组改动基本是测试侧 + 少量代码侧（`workspaceService`/`sessionService`/`claude.ts` 等），回归以 `bun test src/server` 全量（3396/0/0）+ `bun run check:server` 为准。

## 与其他组的关系

- **pr-7 的 27.2（vcc 校准脚本，链位 59）属另一组**：`scripts/vcc-slice-calibration.ts` / `vcc-slice-judge.ts` 是 vcc 片段模式的**测量工具**（语料校准与判分），非产品代码，且配套 `.gitignore` 排除机器生成报告；与本组无共享文件（58/59/60 三者互相独立、也不与链 1–57 共享文件，可在任何位置应用）。
- 链位 12 与 47/58 同属「测试基线」主题但层次不同：12 修的是 `src/server` 的既有真失败（含 4 处代码修复），47/58 修的是 env 泄漏假红并沉淀 `modelEnv.ts` 工具；12 的 ambient env 簇（5 条）与 58 的隔离思路一脉相承但接入范围不同。
- 链位 60 的 `api/claude.ts` bound-thinking hunk 与章八/二十一（思考相关 PR）主题相邻，但按「章内残余 hunk」归入本组补齐链完整性。

## 风险与备注

- ⚠️ **上游冲突风险文件**（上游 main 也改过，PR 合入时需三方合并/冲突处理）：
  - `src/services/api/claude.ts`（链位 60 bound-thinking，且 27.3 注明它是「待办性质」：章八/二十一补丁重生成时未包含，上游若合入思考相关改动此处最易撞）
  - `desktop/package.json`（链位 60 删脚本；上游若加脚本会撞）
  - `src/server/__tests__/conversation-service.test.ts`、`src/server/services/sessionCollaborationService.ts`（链位 12）
- `modelEnv.ts` 及其 12 个用例接入是**新增文件/纯测试改动**，冲突面小；但接入清单较长，上游若在这些 `*.test.ts` 上有大改需逐一核对接入点是否存活。
- 链位 12 含 4 处**代码**修复（`workspaceService` git 探针、`sessionService` mtime-only 排序、`sessionCollaborationService` 游标、whatsapp 动态 import）——PR 描述需明确这些是「修基线既有 bug」而非测试豁免，否则上游 reviewer 可能质疑为何改产品代码。
- 文档 27.4 复核口径提醒：比对补丁是否完整须用 `git apply --index`（不加 `--index` 时新增文件是未跟踪状态，`git diff <commit>` 看不见，会误报成删除）。
