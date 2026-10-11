# 16-connector-linux-platform — 连接器目录 Linux 平台支持（链位 16，16-connector-linux-platform.patch）

> 功能组：pr-8 — Computer Use 解锁 Linux(X11) + 连接器目录 Linux 平台支持（pr-prepare/pr-8/）
> 链位 16，patch `16-connector-linux-platform.patch`（本目录）

- 需求背景：移动端 H5 市场页连接器卡片全显示「当前平台不支持」。`supported` 由服务端按 `platforms.includes(process.platform-process.arch)` 判定，旧目录只声明 darwin/win32，Linux（本机 linux-x64）全部被判不支持。CLI 三连接器（feishu/dingtalk/wecom）还走 `managedRuntime.prepareManagedRuntime`，按平台 pin 下载 URL + sha256/sha512 哈希，且 `os` 映射把 Linux 误当成 darwin URL。
- 方案：
  - `catalog.ts`/`skillCatalog.ts`/`remoteCatalog.ts`：feishu/dingtalk/wecom `platforms` 加 `linux-x64`、`linux-arm64`（skill/remote 平台无关，保守统一声明）。
  - `managedRuntime.ts`（核心）：lark/wecom 归档哈希表 + 三连接器 `initialBinaryHashes` 各补 linux-x64/linux-arm64 pin（URL 均实测可达，dingtalk 归档 sha512 复用同一 tgz，实测与既有 pin 逐字节一致）；修 `os` 映射，Linux 走 `-linux-amd64/arm64` 产物。
  - legacy 版本回退正则 `[a-z]+-(?:arm64|x64)$` 本就通用，linux 目录名可解析，无需改。
- 验证：6 个 Linux pin 全解析（不再抛 "no pinned artifact"）；live 7788 端到端 `prepare` 下载 14MB 归档→sha256 双校验→`lark-cli --version` 实际可执行；`bun test src/services/connectors/` 416 pass / 0 fail（加 linux 平台后顺带修好 8 条既有平台耦合失败）；H5 市场卡片「当前平台不支持」→「待连接账号」。
