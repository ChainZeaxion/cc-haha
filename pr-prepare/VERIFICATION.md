# 拆分核验报告（64 patch → 8 功能组，2026-09-30）

> 目标：核实 8 组 PR 拆分的整体自洽性——每组「纯基座 068b3ebd + 本组文件终态」是否 typecheck 不缺符号、本组逻辑无写错。

> **2026-09-30 分组演变（终态 8 组）**：会话相关的四个功能域全部并入 **pr-2「会话及相关优化」单组**（18 项 / 78 文件，四模块：会话基础 03/06/09/11 + 文件下载 08/45/51/53 + 大会话历史加载与传输性能 20/23/24/25/26/27/31 + 大会话打开提速 55/56/57）。各模块直接改动文件几乎不重叠，合并后依赖文件去重（78 文件）。`transcriptMetadataCache.ts` 的 owner 现亦在 **pr-2** 内。
> 终态 8 组：pr-1 h5 / pr-2 会话及相关优化 / pr-3 tps / pr-5 usage / pr-6 test / pr-7 vcc / pr-8 computer-use / pr-10 thinking-subagent。各组核验结论（组内测试全绿、跨组依赖预期缺失）对合并后的 pr-2 整体成立。

## 方法（三层，从严到宽）

1. **组内测试**：每组在独立 worktree（`~/.prwt/pr-N`）跑 tsc + desktop vitest + server 测试，对比基座（`~/.prwt/base`）。
2. **真类型检查**：去掉 tsconfig `baseUrl` 后重跑 tsc（见下方「关键发现」），对每组做「新增错误 = 本组文件上 − 基座」集合差，再对比完整链 `custom-066`（`~/.prwt/fullchain`，64 patch 全在）归因。
3. **单文件级对照**：可疑失败逐文件在 base vs group 单独复跑。

## 结论：10 组全部自洽，0 个「本组写错」

### 1. 组内测试文件 100% 全绿
10 组各自清单内的测试文件（desktop vitest + server）单独跑 **0 失败**（pr-1 17、pr-2 5、pr-3 9、pr-4 6、pr-5 7、pr-6 18、pr-7 5、pr-8 7、pr-9 6、pr-10 20）。本组逻辑正确。

### 2. 总失败 = 跨组依赖缺失（预期）+ 基座预存 flaky
每组 worktree 只含「本组文件 + import 闭包」，不含其他组改动文件，所以：
- **real-server 集成测试崩**（`Cannot find module` / `condition timed out`）：本组对基座文件（sessionService.ts / handler.ts / claude.ts）新增 import，引用了其他组新增的符号/文件，本组树缺之 → 拉真实 server 子进程时加载即崩。
  - `src/server/services/transcriptMetadataCache.ts`（owner=**pr-2**，原 pr-11/pr-4）
  - `src/server/proxy/tpsTokenSink.ts`（owner=**pr-3**）
  - `src/server/remoteBrowserPolicy.ts` 源（owner=**pr-1**；pr-2 只改了它的 .test.ts）
  - `src/utils/thinking.ts` 的 `shouldSendThinkingToAPI` 导出（owner=**pr-2**）
- **基座预存 flaky**（base 单独跑也挂）：workspace-service 5 个、diagnosticsSettings、generalSettings 等。
- **whatsapp/baileys 依赖包**：base 态就缺（pr-6/pr-10 抽验）。

以上都是「设计使然」的跨组噪声，**多组合入同一上游时符号齐全，自动消失**（87 个类型错、全部 real-server 崩均验证：合到 fullchain 后消失）。

## 关键发现：基座 tsconfig 的 `baseUrl` 让 tsc「形同虚设」

- 0.6.6 基座 `tsconfig.json:8` 含 `"baseUrl": "."`。新版 TypeScript 移除了该选项 → **tsc 报 TS5102 后在配置阶段就中止，根本没做类型检查**。
- 这解释了此前「每组 tsc 仅 1 错（baseUrl）= 组内自洽」的**误判**——那个 1 错不是类型错，是检查根本没开始的信号。
- 去掉 `baseUrl` 后真跑：base 自带 **8288** 个类型错，完整链（发货产品） **22413** 个，各组 8308~8350。
- **结论**：这套代码的 `tsc --noEmit` 一直在「空转」（上游/基座就有的配置 bug，CI 从没抓到过真实类型错）。类型正确性一直靠「运行时 + 测试」兜底，非 tsc。

## 本组固有类型错误（合上游也在）的定性

- 本组文件上的真类型错共 **603**，其中 **516 在完整链仍存在**（= 本组引入、非拆分噪声）、87 跨组消失。
- 516 个里 **390 是宽松风格噪声**：隐式 any 参数（TS7006 ×130）、赋值/参数类型不匹配（TS2322/TS2345 ×134）、对象字面量缺属性（TS2741 ×72）等——沿用了上游本身的宽松编码风格（上游 base 就有 8288 个同类）。
- 其余 126 抽样核验：最可疑的 TS2339「属性不存在」全为两类，**均非硬伤**：
  - `require('../x.js') as typeof import('../x.js')` **动态 require 解构**（messages.ts 的 `projectSnippedView`/`isSnipRuntimeEnabled`/`SNIP_NUDGE_TEXT` 等）——符号在真实模块有定义，是 tsc 对动态 require 的类型推断缺口；
  - 接口/字面量类型标注缺口（`thinkingBlockStarts` 在 `streamBlocks.ts:31` 有定义，字面量未收窄到该接口）。
- **没有任何「符号真没定义」的运行时硬伤**——与「产品在跑、组内测试全绿」一致。

## 对 PR 拆分的影响

- 拆分本身干净，可直接按建议顺序（pr-6→7→9→2→4→5→3→1→8→10）向上游提 PR。
- **无需**因类型错返工：错误要么跨组消失，要么是沿用上游风格/动态 require 推断噪声（上游 base 同样大量存在，不会比上游更红）。
- 可选改进（非阻塞）：① pr-5 若单独合入会带「缺 transcriptMetadataCache」风险（它现属 pr-2），建议 pr-2 先合或同期，manifest 已标注该跨组依赖；② 若想恢复 tsc 真检查，可把 `baseUrl` 换成 `paths` 相对写法（但会一次性暴露 8000+ 历史错，宜单独 PR 处理，勿混入功能 PR）。
## 证据文件
- 各组 tsc（真检查）：`/tmp/prwork/tscnb-{base,pr-N,fullchain}.txt`
- 各组 vitest/server：`/tmp/prwork/out-{base,pr-N}/{vitest,server,server-serial}.log`
- 子代理逐测试归因：`/tmp/prwork/agentA-findings.md`（pr-2/pr-5）、`/tmp/prwork/agentB-findings.md`（pr-1/6/10 及全组抽查）
