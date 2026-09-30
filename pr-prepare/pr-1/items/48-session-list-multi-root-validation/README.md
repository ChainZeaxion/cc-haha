# 48-session-list-multi-root-validation — 会话列表逐行校验改按全部索引根（链位 48，`48-session-list-multi-root-validation.patch`，文档「十」补记二）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 48，patch `48-session-list-multi-root-validation.patch`（本目录）

- 需求背景：多根索引后，会话列表的逐行校验只认本配置目录的根，来自额外根的行被判越界并被 `catch` 静默丢弃——表现为 `total` 报得对、行数却只剩 2，侧边栏分组也丢失。
- 方案：`sessionService.ts` 的逐行越界校验改为按全部索引根（默认根 + `CC_HAHA_EXTRA_PROJECT_ROOTS`）判定，额外根的行不再被丢弃（1 文件约 70 增）。
- 验证：dev 7788 实测平铺列表 2 → 84、侧边栏分组恢复；与链位 46 同属「十」补记，两者配套（48 依赖 46 的多根机制）。
