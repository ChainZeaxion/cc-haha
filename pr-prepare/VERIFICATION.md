# pr-prepare 核验报告

## 一、2026-10-03：双层版重构核验（34 项 / 8 主题）

重构内容：旧「pr-N 目录 + 链位命名（64 项）」→ 双层版「`<主题>/<主题>-<优化项>`（34 项）」，与 `modify/patches/` 同构；8 个 PR 原地更新。

| 核验项 | 方法 | 结果 |
|---|---|---|
| 链终态可复现 | 干净基座 `068b3ebd` + 按 `modify/patches/ORDER.md` apply **34/34** | tree **`56923871`** ✅ |
| 组补丁干净 | 8 个 `00-group.patch` 各自在干净基座 `git apply` | **8/8 成功** ✅ |
| 组补丁 = 分支树 | 每组 apply + `git add -A` + `git write-tree` vs 对应 `pr/<slug>` 树 | **8/8 逐字节一致** ✅<br>h5 `379c9b46` · session `3f9d4d45` · tps `fb73ebca` · usage `66571b6b` · test `4e75a5bc` · vcc `7e26f8ed` · computer-use `5b921ba4` · thinking-subagent `d8ba6201` |
| 8 组文件集并集 = 链终态 | 并集 == `git diff --name-only 068b3ebd 56923871`（308 文件） | ✅ 一致，且无重复归属（按「最后归属主题」唯一划分） |
| PR 原地更新 | 8 个分支推 `ChainZeaxion/cc-haha` 同名分支 | headRefOid 全部更新 ✅<br>h5 `dec94b8c` · session `56fff42b` · tps `6d1656e2` · usage `fd64e3f9` · test `8deb76d3` · vcc `2659df47` · computer-use `23625473` · thinking-subagent `6f226f7c` |

**相对上一版 PR 的实际变化**：`tps` 组 +21 文件/+1783−153（新增链位 66/67 与 `session-total` 的 `tpsDensityStore.ts`、`StreamingIndicator.tsx`、`agentRunUsageProjection.ts`、`anthropicTokenTap.ts`、`tokenDensity.ts`、`localEngineHost.ts`、`providerRuntimeEnv.ts` 等）；`thinking-subagent` / `session` / `h5` 仅共享文件（`tpsMeter.ts`/`chatStore.ts`/`TpsIndicator.tsx`/`handler.ts`）刷到链终态；`usage`/`test`/`vcc`/`computer-use` 与上一版**逐字节一致**。

> ⚠️ 组补丁**仅在基座上单独 apply**，不可本机顺序叠加（见 `00-overview.md` 第三节）。

---

## 二、2026-09-30：拆分自洽性核验（承接，64 项 → 8 组）

> 结论对本轮仍然成立（分组与文件归属规则未变，仅命名与项粒度更新）。

### 方法（三层）
1. **组内测试**：每组独立 worktree 跑 tsc + desktop vitest + server 测试，对比基座。
2. **真类型检查**：去掉 `tsconfig` `baseUrl` 后重跑 tsc，做「新增错误 = 本组 − 基座」集合差。
3. **单文件级对照**：可疑失败逐文件在 base vs group 复跑。

### 结论
- **组内测试文件 100% 全绿**（各组清单内测试单独跑 0 失败）⇒ 本组逻辑正确。
- **总失败 = 跨组依赖缺失（设计使然）+ 基座预存 flaky**：每组只含「本组文件 + import 闭包」，不含他组改动 ⇒ real-server 集成测试会因缺 `transcriptMetadataCache.ts`(session) / `tpsTokenSink.ts`(tps) / `remoteBrowserPolicy.ts`(h5) 等而崩。**多组合入上游时符号齐全，自动消失**。
- **无任何「符号真没定义」的运行时硬伤**。

### ⚠️ 关键发现：基座 `baseUrl` 让 `tsc --noEmit` 空转
- `tsconfig.json` 含 `"baseUrl": "."`，新版 TS 已移除该选项 ⇒ **tsc 报 `TS5102` 后在配置阶段中止，根本没做类型检查**（此前「每组仅 1 错 = 自洽」是**误判**）。
- 去 `baseUrl` 后真跑：base 自带 **8288** 类型错，完整链 **22413**，各组 8308~8350。⇒ 这套代码的 `tsc --noEmit` 一直在空转，类型正确性靠**运行时 + 测试**兜底。
- 本组文件上的真类型错多为**沿用上游宽松风格**（隐式 any / 赋值不匹配）与**动态 `require` 推断缺口**，非硬伤。

### 证据（历史，可能已清理）
- 各组 tsc（真检查）：`/tmp/prwork/tscnb-{base,pr-N,fullchain}.txt`
- 各组 vitest/server：`/tmp/prwork/out-{base,pr-N}/{vitest,server,server-serial}.log`
- 子代理逐测试归因：`/tmp/prwork/agentA-findings.md`、`/tmp/prwork/agentB-findings.md`

---

## 三、验收口径（每 PR）

- 桌面：`cd desktop && bunx vitest run`（**必须在 `desktop/` 下跑**）
- 服务端：`bun test src/server`（**勿**用 `bun test src`：位置参数是**子串匹配**，会把 `desktop/src/**` 的 vitest 用例拉进来，产生大量假失败）
- typecheck：**注意 `baseUrl` 空转**，须去掉后跑（见上）。
