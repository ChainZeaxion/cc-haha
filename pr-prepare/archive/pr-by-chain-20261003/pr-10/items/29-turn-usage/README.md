# 29-turn-usage — 轮次用量（每轮总消耗 token）（链位 29，`29-turn-usage.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 29，patch `29-turn-usage.patch`（本目录）

- 需求背景：用户要求在每轮正文下附带信息（`复制 分享 · 日期时间 · 耗时`）中增加「每轮总消耗 token 量」，且「think 不回传则不纳入 think 用量」，并避免挤兑式大量计算浪费性能。
- 方案：
  - 口径裁决取**真实 `output_tokens`**（API 回传、`usageKey` 去重）——thinking 已含在 output 内，provider 不回传 thinking 时自然不计，恰好落实「不回传则不纳入」；
  - 性能：用量是已落 transcript 的真实数字（服务端 `sessionService` 归一化后连 `usageKey` 下发），读取即用零估算；累加挂进 `turnCompletion.ts` 既有 for 循环（`usageKey` 去重），不新增遍历；
  - 一轮=多次 API 调用，故求和；`0` 视为「未自报」不显示；行被并入上一行时 `stampResponseUsage` 双向扫描且「拒绝覆盖已带 usage 的行」；
  - 展示 `TurnCompletionStamp.tsx` 位于耗时之前；`types/chat.ts` 三个 UIMessage 变体加 `usage`/`usageKey`；i18n 5 语言加 `chat.turnUsage`。
- 验证：`turnCompletion` 19/19（含 6 条用量用例）、`TurnCompletionStamp` 8/8、locale 7/7、`chatStore` 360/360；`components/chat`+`lib`+`i18n` 家族 1763/1763；`tsc --noEmit` 与 eslint 均 exit 0。
