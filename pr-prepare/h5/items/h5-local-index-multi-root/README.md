# h5-local-index-multi-root — 本地索引多项目根 + 会话列表多根校验（原链位 46,48）

> 功能主题：`h5` — H5 远程访问与移动端支持（`pr-prepare/h5/`）｜ PR 分支 `h5-remote-access`
> **单一真相源 patch**：`modify/patches/h5/h5-local-index-multi-root-patch1.patch`（4 文件 +292−121）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 46 | `local-index-extra-project-roots` | 十 补记：`CC_HAHA_EXTRA_PROJECT_ROOTS` **额外索引根**——dev 实例用自己的 `CLAUDE_CONFIG_DIR` ⇒ 发现根随之变成自己的，真实目录的会话永不出现；该配置可额外索引真实 `projects/`（3 文件 222 增） |
| 48 | `session-list-multi-root-validation` | 十 补记二：会话列表**逐行校验改按全部索引根**——只认本配置目录的根时，额外根来的行被判越界并被 `catch` **静默丢弃**（于是 `total` 报得对、行数只剩 2）；平铺 2 → 84、侧边栏分组恢复（1 文件 70 增） |

## 明细

### 原链位 46 — `local-index-extra-project-roots`

- 需求背景：本地 dev 实例用自己的 `CLAUDE_CONFIG_DIR`（与桌面端 8877 隔离），会话本地索引的「发现根」随 `CLAUDE_CONFIG_DIR` 变成 dev 自己的 `projects/` 目录，真实项目目录下的会话在 dev/H5 上永不出现（dev 列表原本只含 dev 自己的 2 条会话）。
- 方案：localIndex `config.ts`/`coordinator.ts` 支持 `CC_HAHA_EXTRA_PROJECT_ROOTS` 环境变量——在默认发现根之外额外索引真实 `~/.claude/projects/` 等根，dev 实例可同时看到真实目录的会话（实测 2 → 84 条）。刻意不改共享 `CLAUDE_CONFIG_DIR`（两进程共写同一索引 DB，rebuild 会清空生产）。
- 验证：dev 7788 实例实测会话列表从 2 条恢复到 84 条；含 `coordinator.test.ts` 单测；patch 对 0.6.6 基线干净应用。

### 原链位 48 — `session-list-multi-root-validation`

- 需求背景：多根索引后，会话列表的逐行校验只认本配置目录的根，来自额外根的行被判越界并被 `catch` 静默丢弃——表现为 `total` 报得对、行数却只剩 2，侧边栏分组也丢失。
- 方案：`sessionService.ts` 的逐行越界校验改为按全部索引根（默认根 + `CC_HAHA_EXTRA_PROJECT_ROOTS`）判定，额外根的行不再被丢弃（1 文件约 70 增）。
- 验证：dev 7788 实测平铺列表 2 → 84、侧边栏分组恢复；与链位 46 同属「十」补记，两者配套（48 依赖 46 的多根机制）。
