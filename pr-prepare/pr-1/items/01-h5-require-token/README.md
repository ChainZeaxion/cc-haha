# 01-h5-require-token — H5「需要访问令牌」开关 + loopback/私网/ULA 免令牌（链位 1，`01-h5-require-token.patch`）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 1，patch `01-h5-require-token.patch`（本目录）

- 需求背景：0.5.3 旧实现有 H5 令牌开关与私网豁免，0.6.6 基座无 `requireToken` 字段（`normalizeStoredSettings` 静默丢弃），且私网来源（LAN IP 浏览器）不被豁免、桌面前端 `requiresH5AuthForServerUrl` 只豁免 loopback，导致 LAN 手机打开 H5 仍弹 token 输入。与用户确认最终语义：默认 `requireToken: false` = 全免 token；开启时 loopback + RFC1918 + IPv6 ULA（fc00::/7）按 socket 源地址（`server.requestIP()`）免 token，公网需 Bearer token。
- 方案：
  - `h5AccessService.ts` 加 `requireToken: boolean`（默认 false，`=== true` 解析）；`api/h5-access.ts` PUT 透传。
  - `h5AccessPolicy.ts` 新增 `isPrivateIPv4Source` 与 `isTrustedLocalSourceHost`（剥 bracket/`::ffff:` 前缀 → loopback → ULA 正则 → 私网 IPv4），`shouldRequireH5Token` 加必填 `requireToken` 参数。
  - 桌面端 `desktopRuntime.ts` 加 tokenless 快速路径：health 后先探 `/api/status`，仅 401(missing-token) 才落 token 输入流程。
  - `H5AccessSettings.tsx` enabled 行下新增 checkbox，即时生效（非 draft/save）；i18n 5 语言各 2 key；settingsStore/api/types 同步加字段。
- 验证：服务端 h5-access-policy 31/31 + h5-access-service 28/28；桌面 generalSettings 131、settingsStore 64、desktopRuntime 30/30（含 LAN 免 token 直连新用例）；dev 7788 live 在 LAN/loopback/模拟公网 XFF 下按 requireToken 两种取值全部符合预期，控制面 PUT 落盘正确。真实设备回归：192.168.10.140 手机免 token 直连成功（此前失败根因是 dist bundle 过期）。
