# 41-background-task-duration-restore — 后台任务耗时恢复三层根因（链位 41，`41-background-task-duration-restore.patch`）

> 功能组：pr-10 — 思考计时与子代理用量（think 真值/耗时/跨客户端一致/实时跟进）（pr-prepare/pr-10/）
> 链位 41，patch `41-background-task-duration-restore.patch`（本目录）

- 需求背景：用户反馈「重开老会话后后台任务不显示耗时」（新会话当场能看到）。排查为三层互相独立的根因叠加，修掉任一层都看不到效果。
- 方案：
  - 根因一：`historyComplete=false` 时窗口被整空 → 跨度类重建改用已加载窗口（`goal`/`todos` 仍受完整性闸门）；实测 28.8MB 会话 1.5s 撞 `HISTORY_STITCH_MAX_PAGES=40` 上限致 `historyComplete` 恒 false，改后 44 条后台任务、33 条有真实跨度（置空则 0 条）；
  - 根因二：通知型任务无起点 → 新增 `backfillTaskStartsFromToolCalls` 用 `toolUseId` 找到工具调用时刻回填 `startedAt`（补齐后 44/44 全有跨度）；
  - 根因三（最深）：`mergeBackgroundAgentTaskRecords` 把恢复出来的 `startedAt` 抹成 `now` → 改为 `startsNewLifecycle ? now : existing?.startedAt ?? event.startedAt ?? now`（修后全链路 44/44）；
  - 显示改紧凑 ASCII（`43s`/`4m1s`/`1h2m`，超 1h 不显秒），范围仅活动面板后台任务；补齐「会话扩展信息」开关漏管的后台任务内联卡耗时。
- 验证（链位 41）：`tsc --noEmit` 0 错；`chatStore.test` 369（+3）、`SessionActivityPanel.test` 26、`MessageList.test` 202（+1）；桌面全量 6315 通过 / 0 失败。
