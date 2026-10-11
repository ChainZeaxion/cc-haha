# 46-local-index-extra-project-roots — 额外索引根 `CC_HAHA_EXTRA_PROJECT_ROOTS`（链位 46，`46-local-index-extra-project-roots.patch`，文档「十」补记）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 46，patch `46-local-index-extra-project-roots.patch`（本目录）

- 需求背景：本地 dev 实例用自己的 `CLAUDE_CONFIG_DIR`（与桌面端 8877 隔离），会话本地索引的「发现根」随 `CLAUDE_CONFIG_DIR` 变成 dev 自己的 `projects/` 目录，真实项目目录下的会话在 dev/H5 上永不出现（dev 列表原本只含 dev 自己的 2 条会话）。
- 方案：localIndex `config.ts`/`coordinator.ts` 支持 `CC_HAHA_EXTRA_PROJECT_ROOTS` 环境变量——在默认发现根之外额外索引真实 `~/.claude/projects/` 等根，dev 实例可同时看到真实目录的会话（实测 2 → 84 条）。刻意不改共享 `CLAUDE_CONFIG_DIR`（两进程共写同一索引 DB，rebuild 会清空生产）。
- 验证：dev 7788 实例实测会话列表从 2 条恢复到 84 条；含 `coordinator.test.ts` 单测；patch 对 0.6.6 基线干净应用。
