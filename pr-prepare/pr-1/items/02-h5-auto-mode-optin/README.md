# 02-h5-auto-mode-optin — H5 选「自动模式」持续 400 修复（链位 2，`02-h5-auto-mode-optin.patch`，对应文档 1.1）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 2，patch `02-h5-auto-mode-optin.patch`（本目录）

- 需求背景：H5（手机浏览器）权限审批选「自动模式」点确认后 toast 持续报 400。根因：`acceptAutoModeOptIn()` 走 `PUT /api/settings/user {skipAutoPermissionPrompt:true}`，H5 请求被分类为 `h5-browser` 后走 `validateRemoteSettingsPatch` 白名单校验，而 `WRITE_SETTINGS` 白名单 5 个字段不含 `skipAutoPermissionPrompt`（只读不可写）→ 400 `Unsupported General setting`；桌面端 local-trusted 不走此校验故仅 H5 报错。
- 方案：`src/server/remoteBrowserPolicy.ts` 的 `WRITE_SETTINGS` 白名单加入 `skipAutoPermissionPrompt`（boolean，复用既有 `typeof value === 'boolean'` 末行校验），风险等级与其它白名单布尔字段一致。
- 验证：`router.remoteBrowser.test.ts` 合法 patch 用例加该字段并补「单独 PUT 200+落盘」「字符串 `'true'` 仍 400」断言，8/8 pass；dev 7788 live（LAN 视角）修复前 400 → 修复后 200 且 GET 读回落盘正确。
