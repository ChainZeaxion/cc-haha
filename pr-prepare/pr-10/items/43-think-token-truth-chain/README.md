# 43-think-token-truth-chain — 思考 token 走引擎真值（链位 43，`43-think-token-truth-chain.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 43，patch `43-think-token-truth-chain.patch`（本目录）

- 需求背景：思考 token 此前只能估算，用户希望「think 真值」——让思考用量取引擎回传的真实 `reasoning_tokens`，并让 `AgentTaskNotification` 携带 `output_tokens`/`think_tokens` 供桌面拆分渲染。
- 方案：
  - 代理透传 `reasoning_tokens`（兼容 vLLM `completion_tokens_details` 与 Responses `output_tokens_details`）；
  - usage 保活强转；`ProgressTracker` 逐轮「真值否则估算」；
  - `AgentTaskNotification` 带 `output_tokens`/`think_tokens` → 桌面拆分渲染；
  - 契约=**发射方决定形态**（think 回传时界面回单一总量，不回传时拆 think/非think 两段）。
- 验证：21 文件 669 增；思考 token 由估算升级为引擎真值，与链位 49/52 的拆分口径衔接。
