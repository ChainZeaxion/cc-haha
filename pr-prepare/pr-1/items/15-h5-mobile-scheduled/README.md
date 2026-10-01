# 15-h5-mobile-scheduled — H5/移动端支持打开计划任务（定时任务）页（链位 15，`15-h5-mobile-scheduled.patch`）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 15，patch `15-h5-mobile-scheduled.patch`（本目录）

- 需求背景：用户 verbatim：「再把计划任务也给移动端访问H5打开适配」。计划任务页本身纯 `taskStore`+HTTP 无桌面宿主依赖，但被两处拦截：`Sidebar.tsx` 定时任务 NavItem 包在 `{!isMobile}` 内（移动端抽屉无入口）；`AppShell.tsx:275` 移动端 effect 早退条件不含 scheduled（scheduled tab 被强制踢回会话）。
- 方案：`Sidebar.tsx` NavItem 移出 `!isMobile` 包裹；`AppShell.tsx` 早退条件加 `activeTab?.type === 'scheduled'` + mobile-session-header 加 scheduled 标题分支；`ScheduledTasks.tsx` 内容容器 `px-11` → `px-4 lg:px-11` 移动端响应式；同步更新 `Sidebar.test.tsx` 中移动端导航断言。
- 验证：tsc 0 错；Sidebar/AppShell/ContentRouter 135/135；全量前端 vitest 仅 2 条既有 MessageList flaky（单跑全过）；live 7788 iPhone 14：抽屉出现「定时任务」→点击后页头/新建任务按钮/桌面在线提示条均正常；18 链全验证干净。
