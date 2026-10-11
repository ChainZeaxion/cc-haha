# 28-thinking-badge-order-and-duration — 收纳栏顺序 + `+` 间隔 + 零耗时按未测处理（链位 28，`28-thinking-badge-order-and-duration.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 28，patch `28-thinking-badge-order-and-duration.patch`（本目录）

- 需求背景：用户指出收纳栏应「先显示 token 用量、再显示耗时」，`+` 号两段用量间隔不宜过大过小；think 内容现有 token 却无耗时需处理，老历史记录无耗时可跳过。
- 方案：
  - 顺序由「耗时在前、token 在后」改为「token 在前、耗时在后」；
  - `+` 间隔：monospace 字体里一个空格是固定宽度无法压小，改为结构化渲染——新增 `activityTokenParts(usage): string[]`，渲染层用 `flex gap-[3px]` 控制；`activityTokenLabel()` 保留为 `parts.join(' + ')` 不改既有签名；
  - 零耗时按「未测」处理：服务端缺锚点时不写该字段（`return {}`），客户端 `thinkingDurationMs === undefined || <= 0` 一律只显示 token（兼容已落盘的旧 0 值）。
- 验证：`ThinkingBlock` 23/23、`ActivityGroup` 16/16、前端 chat 家族 1246/1246（47 文件）、服务端 api 244/244、desktop `tsc --noEmit` 与 eslint 均 EXIT=0。实测坐实「旧进程比功能早 4 小时，重启后新思考块才带耗时」。
