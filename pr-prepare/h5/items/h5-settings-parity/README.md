# h5-settings-parity — H5 设置全对齐（原链位 4）

> 功能主题：`h5` — H5 远程访问与移动端支持（`pr-prepare/h5/`）｜ PR 分支 `h5-remote-access`
> **单一真相源 patch**：`modify/patches/h5/h5-settings-parity-patch1.patch`（4 文件 +212−134）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 4 | `h5-settings-parity` | 九 H5 设置全 tab 对齐 |

## 明细

### 原链位 4 — `h5-settings-parity`

- 需求背景：0.6.6 浏览器端设置页被「围栏」限制——`Settings.tsx` 按 `getDesktopHost().isDesktop` 分流，浏览器只渲染 `H5Settings`，而它原本只有 2 个 pill（providers + general）；桌面端有 15 个主 tab + about 共 16 项。用户要求 H5 在手机浏览器上像桌面端一样看到并使用全部设置项（含通用 tab 换桌面完整版 GeneralSettings，接受浏览器端设置写回主机）。
- 方案：
  - `Settings.tsx` 提取模块级 `SETTINGS_TABS`（15 项）+ `SETTINGS_ABOUT_TAB` 常量，桌面 rail 改遍历复用。
  - 重写 `H5Settings.tsx`：与桌面一致的 16 项，导航改横向可滚动 pill 条（`overflow-x-auto`，窄屏适配，选中项 `scrollIntoView`）；内容区 16 分支与桌面 switch 一致，providers 保留 `browserMode`，general 用桌面完整版 `GeneralSettings`，skills/plugins 用本地包装同构渲染。
  - 删除 `H5GeneralSettings.tsx`（被桌面 GeneralSettings 取代）；重写 `H5Settings.test.tsx`（13 个组件 mock，8 用例，pill 数断言 16）。
- 验证：`H5Settings.test.tsx` 8/8；desktop 全量 vitest 6137 pass（仅 2 条与本次无关的既有失败）；`tsc -b` 0 错误；重 build 后线上 App chunk 含新横向导航特征 class，确认新设置页已打包伺服；patch 对 v0.6.6 基线 `git apply --check` 干净。
