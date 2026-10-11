# 23-history-transport-bounds — 历史传输裁剪 + 读取预算收紧（链位 23，`23-history-transport-bounds.patch`，对应文档 A+H 项）

> 功能组：pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）（pr-prepare/pr-9/）
> 链位 23，patch `23-history-transport-bounds.patch`（本目录）

- 需求背景：大体积会话白屏真因：客户端首个 `mode=full` 请求撞 120s 超时（诊断日志 ×12，含仅 13.6MB 的会话），阻塞式 `await getFullHistory` 永不 resolve → 白屏。膨胀源为 `toolUseResult.originalFile`：本会话 20 条 >1MB 记录共 78.6MB（占 66%），全局 518 个 transcript 共 3.0GB。
- 方案：
  - **A（读取层有界投影）**：`boundedSessionHistory.ts` 新增 `boundToolUseResultPreview()`，`sessionService.entryToMessage` 接入——传输层只截超长字符串（>16KB），键与容器类型全保留；**不置 `bodyTruncated`**（避免翻转 `historyComplete=false` 触发 recovery 循环）；仅作用于展示/传输路径，recovery 与语义归约路径仍取原始记录。
  - **H（预算收紧）**：`HISTORY_FULL_BYTES` 32MB → **8MB**；**配对** `HISTORY_FULL_SCAN_BYTES` 64MB → **24MB**（=3×输出；扫描预算才是延迟上界，只降输出会允许「读 64MB 吐 8MB」）。
- 验证：真实会话 `db39b34d`（1844 条 toolUseResult）：toolUseResult 合计 106.6MB → **6.6MB（-93.8%）**；单条最大 3.93MB → 48KB；`mode=full` 单响应上限 33.2MB → ≤8MB。保留性：`filePath` 原样、`structuredPatch` 未被截（hunk 完整）、`originalFile` 仍为字符串（满足 schema 必填 `z.string()` 与 UI 无保护 `.split`）。测试：`boundedSessionHistory` 21/21、会话相关服务端测试 342/342、新增 3 个专项用例（截断保键、小结果字节不变、不置 `bodyTruncated`）。
