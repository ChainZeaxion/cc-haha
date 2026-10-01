# 13-h5-mobile-quick-actions — H5 悬浮快捷入口（任务列表/终端/文件浏览/审查）（链位 13，`13-h5-mobile-quick-actions.patch`）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 13，patch `13-h5-mobile-quick-actions.patch`（本目录）

- 需求背景：移动端（H5 手机浏览器）会话页缺少桌面端的任务列表/终端/文件浏览/审查入口（0.6.6 现状：移动端不渲染 TabBar，三面板均硬编码 `!isMobileLayout` 禁用）。需悬浮（FAB）快捷入口，点击展开菜单、面板以全屏 overlay 呈现。参考旧 fork §5.2 的 MobileQuickActions 模式，本次入口从 3 项扩为 4 项（新增「审查」=文件浏览面板的 review tab）。
- 方案：
  - 新增 `MobileQuickActions.tsx`：FAB（`bolt` 图标，open 时 rotate-45）点击横向展开 4 个胶囊按钮（任务列表/终端/文件浏览/审查），`useDismissable` 点外部/Esc 收起，i18n 5 语言 5 key。
  - `ActiveSession.tsx`：本地 `mobileWorkspaceOpen` state（后台 `openTarget` 不弹 overlay，仅 FAB 显式点按才弹）；移动端全屏 overlay（`fixed inset-0`，顶栏标题+关闭按钮，内容 `WorkspaceSurface dock="side"`）；终端/文件/审查共用同一 overlay，由 `openWorkspaceTarget` 的 `target.kind`（`file`/`review`/`terminal`）区分，终端 tab 走 H5 终端桥接 WS。
- 验证：新增 `MobileQuickActions.test.tsx` 3 用例 + `ActiveSession.test.tsx` 新用例（overlay 开/关、终端 tab）；`tsc -b` 0 错，受影响 58/58，全量前端 vitest 6150 pass/0 fail（零回归）；live 7788 iPhone 14（390×844）全验证：4 项展开、文件树/review tab/终端 xterm（WS spawn 后显示 zsh prompt）均正常，关闭后 overlay 卸载。
