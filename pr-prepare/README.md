# pr-prepare 索引（64 patch → 8 功能组）



> 目标：按功能域拆分本地 64 个优化 patch（0.6.6 基座重实现，`modify/patches/`），每组独立向上游 `NanmiCoder/cc-haha` 提交 PR（head 分支 `ChainZeaxion/cc-haha` 的 `pr/<slug>`）。**当前为准备阶段，尚未推任何 PR。**

每个 `pr-N/` 目录含：
- `README.md` — 功能域概述 + 每个优化项的需求背景/方案/验证（从 `modify/cc-haha自定义优化-0.6.6重实现.md` 对应章节提炼）
- `manifest.md` — patch 清单（链位/行数/文件数/文档说明）+ 文档章节行号 + 文件清单（标注「本组直接改动」vs「依赖补齐」、⚠️ 上游 main 也改过的冲突风险文件）
- `00-group.patch` — **整组合并 diff**（基座 068b3ebd → 该组终态，已验证在基座上 apply 干净且树逐字节一致；按功能域提 PR 时用它）
- `items/<链位>-<name>/` — **每个优化项独立目录**（64 项）：含该项的 `NN-<name>.patch` + 独立 `README.md`（需求背景/方案/验证）。支持**按单项/多项灵活组合**提 PR。
- `NN-<name>.patch` — 按链位命名的单 patch（**链内顺序 apply** 时逐项使用）

「文件数」= 本组 patch 直接改动 + import 闭包传递依赖（他组改动的共享文件按链内终态并入，保证组内自洽、typecheck 不缺符号；多组合入同一上游时共享文件内容相同，自动无冲突合并）。

## 提 PR 的用法（2026-09-30 核验通过，见 VERIFICATION.md）

- **按功能域整组提（推荐主粒度）**：基座 `068b3ebd` 上 `git apply pr-N/00-group.patch`。8 组**全部** apply 干净且树逐字节一致（净 diff，最稳）。
- **全链按序还原产品**：64 个 `NN-<name>.patch` 按链位升序在基座上 `git apply`，**64/64 干净**，终态逐字节 == `custom-066`。
- **按单项独立提**：`items/<链位>-<name>/NN-<name>.patch`。注意这些是**顺序链 patch**——实测 31/64 在基座上单独 apply 干净（只碰前链位未改动的文件），其余 33 个与同链**前序项共享文件 hunk**（或依赖前链位才新建的文件，如 `TpsIndicator.test.tsx`），需**按链位顺序叠加**前序项才能 apply。要单独成 PR 的项：若它单独 apply 干净可直接用；否则需连带其同文件的前序项，或按「基座→该项及其前序共享项终态」重新生成净 diff。
- **跨组组合**：留意跨组依赖（pr-5 的 real-server 集成测试依赖 pr-2 的 `transcriptMetadataCache.ts`、pr-3 的 `tpsTokenSink.ts`），建议同 PR 或先合依赖组。
- **验证口径**：`tsc --noEmit` 受基座 `baseUrl` 配置影响会在配置阶段中止（TS5102），不能直接作自洽判据；类型检查须去 `baseUrl` 后跑（见 VERIFICATION.md）。
## 建议合入顺序（减少后续组的冲突面）

pr-6 → pr-7 → pr-2 → pr-5 → pr-3 → pr-1 → pr-8 → pr-10（pr-10 依赖 pr-3 的 tpsMeter stream 标记与 pr-5 的 usage 口径；pr-5 依赖 pr-2 的 `transcriptMetadataCache.ts`）
## 组清单

| 组 | 分支 slug | 功能域 | patch 数 | 文件数 | 目录 |
|----|----------|--------|---------|--------|------|

| pr-1 | `h5-remote-access` | H5 远程访问与移动端支持 | 10 | 83 | `pr-prepare/pr-1/` |
| pr-2 | `session-related-optimizations` | **会话及相关优化**（合并组，四模块：会话基础 + 文件下载 + 大会话历史加载/传输性能 + 大会话打开提速，详见组 README） | 18 | 78 | `pr-prepare/pr-2/` |
| pr-3 | `tps-indicator` | TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎） | 10 | 60 | `pr-prepare/pr-3/` |
| pr-5 | `usage-billing` | 上下文缓存计费与用量聚合显示 | 3 | 26 | `pr-prepare/pr-5/` |
| pr-6 | `test-baseline` | 测试环境隔离与基线修复（含章内残余 hunk） | 4 | 31 | `pr-prepare/pr-6/` |
| pr-7 | `vcc-compaction` | vcc 算法压缩（pi-vcc 移植 + 窗口分档 + 降级兜底 + 校准脚本） | 5 | 58 | `pr-prepare/pr-7/` |
| pr-8 | `computer-use-linux` | Computer Use 解锁 Linux(X11) + 连接器平台支持 | 4 | 40 | `pr-prepare/pr-8/` |
| pr-10 | `thinking-subagent` | 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进） | 10 | 73 | `pr-prepare/pr-10/` |