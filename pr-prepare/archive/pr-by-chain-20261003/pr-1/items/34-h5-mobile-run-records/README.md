# 34-h5-mobile-run-records — H5 打不开子代理运行记录：移动端 tab 守卫白名单补 subagent/team-member（链位 34，`34-h5-mobile-run-records.patch`）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 34，patch `34-h5-mobile-run-records.patch`（本目录）

- 需求背景：用户 verbatim：「H5访问的打不开子代理运行记录。无法查看子代理在运行中的情况。」根因：`AppShell.tsx` 有仅移动端（`isMobileShell`）的守卫 effect——activeTab 不属于 `session`/`settings`/`market`/`scheduled` 白名单就强制切回聊天 tab，而 `subagent`/`team-member` 从未登记（该白名单随移动端逐页支持扩展，market/scheduled 是各自章节补进去的，run 记录页漏了）；桌面端该 effect 不执行故完全复现不出，且无任何报错、只表现「打不开」。
- 方案：`AppShell.tsx` 守卫白名单补 `subagent`/`team-member` 并加注释说明 run 记录页本就是移动端可达目的地（`ContentRouter` 渲染、两页有移动端布局）；`AppShell.test.tsx` 加 2 用例：subagent 时不得 `setActiveTab`（正向）+ terminal 仍必须回落聊天 tab（反向钉住边界，防白名单过度放宽）。
- 验证：`AppShell.test.tsx` 24/24；`tsc --noEmit` 0 错；vite build 后 grep 产物 bundle 确认守卫含 `"subagent"===` 与 `"team-member"===` 分支；7788 dev sidecar（`CLAUDE_H5_DIST_DIR` 指仓库 dist）重启后 H5 实测可达。经验：「只有 H5 坏、桌面正常」优先查 `isMobileShell` 分支；此后新增移动端页面须把「守卫白名单」列为固定核对项。
