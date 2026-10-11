# 12-server-test-baseline-zeroing — src/server 既有 22 条测试失败清零（链位 12，`12-server-test-baseline-zeroing.patch`，7 文件 +95/−16）

> 功能组：pr-6 — 测试环境隔离与基线修复（pr-prepare/pr-6/）
> 链位 12，patch `12-server-test-baseline-zeroing.patch`（本目录）

- **需求背景**：基线上 `bun test src/server` 存在 22 条既有失败（纯基线遗留，与本仓优化无关）。失败原因混杂（locale、env 泄漏、无界文件读、平台耦合等），若不先清零，后续任何真实回归都会被噪声淹没，无法立刻发现。
- **方案**：8 类根因分「修代码 4 + 修测试 4」处理——
  - git locale（7 条）：`workspaceService.ts` 移植退出码探针 `git rev-parse --is-inside-work-tree`，不再依赖英文 stderr 子串 `not a git repository`（中文 locale 输出 `不是 git 仓库` 致误判）；`runGit` 区分「git 没跑起来」vs「跑了但拒绝」。
  - ambient env 泄漏（5 条）：`conversation-service.test.ts` 补清 `EMIT_SESSION_STATE_EVENTS`/`FIRST_TOKEN_TIMEOUT_MS`；`full-flow.test.ts` 加 `TOKEN_ENV_KEYS` 保存/删除/恢复。
  - findSessionFile 无界全文读（4 条）：文件系统回退路径改 mtime-only 排序，仅同 id 有 ≥2 个候选文件时才做 transcript 偏好读。
  - 协作游标 depth 计数（1 条）：depth 仅在跨物理页时递增，同页 `end` 游标保持 depth。
  - 缺依赖 500（2 条）：`adapters/whatsapp/session.ts` 顶层静态 import 改动态 `import()`（懒加载），缺依赖只在真正 login 时失败。
  - 平台耦合（2 条）：connector 版本正则平台 token 放宽为 `[a-z]+`；workspaceWatch 测试等待各平台都会产生的 `a.ts`。
- **验证**：`bun test src/server` 全量 **3396 pass / 0 fail / 0 error**（22 条全清，零新增）；逐簇回归全绿（conversation-service 75/75、sessions 315/315、connector 24/24、h5-access-auth 53/53 等）；`desktop tsc -b` exit 0。
