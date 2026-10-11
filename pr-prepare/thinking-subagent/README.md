# thinking-subagent — 思考计时与子代理用量

> PR 分支：`thinking-subagent`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/thinking-subagent/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `thinking-subagent-thinking-tool-timing` | `thinking-subagent-thinking-tool-timing-patch1.patch` | 21,28,29,39,41,43,49,61 | +3346−139 | 54 |
| `thinking-subagent-split-no-double-count` | `thinking-subagent-split-no-double-count-patch1.patch` | 52 | +166−14 | 4 |
| `thinking-subagent-subagent-usage-cross-client` | `thinking-subagent-subagent-usage-cross-client-patch1.patch` | 63 | +1067−39 | 11 |

## 功能域概述

本组把「思考耗时 / token」与「子代理用量 / 耗时」两类读数做全链路打通：既让主会话的思考横条从服务端收到 think 块起实时计时并展示 token 用量，也让子代理（并发派发）的耗时取区间并集跨度、用量按 think/非think 拆分并按 `toolUseId` 跨客户端对齐。整组横跨 SDK→WS→服务端推导→客户端渲染四层，10 个 patch 共同依赖 `chatStore.ts` / `MessageList.tsx` / `ToolCallGroup.tsx` / `activityGroupModel.ts` 等共享文件，是功能交织最密集的一组。

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（3 项）：
- `items/thinking-subagent-thinking-tool-timing/README.md`
- `items/thinking-subagent-split-no-double-count/README.md`
- `items/thinking-subagent-subagent-usage-cross-client/README.md`
