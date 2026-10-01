# 44-tps-tokens-kind-and-reasoning-passthrough — `tps_tokens` 带 kind + 代理透传 `reasoning_tokens`（链位 44，`44-tps-tokens-kind-and-reasoning-passthrough.patch`，12 文件 +232/−30）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 44，patch `44-tps-tokens-kind-and-reasoning-passthrough.patch`（本目录）

- **问题/需求**：思考徽章要取**精确单块** thinking token，但转录无此字段（只能估）；`tps_tokens` 原只带总量，无法区分 thinking/content/tool。
- **方案**：`tps_tokens` WS 帧的 token 计数带 **kind**（thinking/content/tool），思考徽章据此取精确单块；代理层透传 `reasoning_tokens`（兼容 vLLM `completion_tokens_details` 与 Responses `output_tokens_details` 两种形状）。
- **验证**：本 patch 为链终态→工作树干净差分，链重放 0 失败；kind 拆分与 reasoning 透传在思考徽章（pr-9 思考计时族）与用量拆分（pr-10 子代理用量族）中被下游消费，端到端数字与引擎日志核对一致。
