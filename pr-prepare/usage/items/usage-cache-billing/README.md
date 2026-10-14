# usage-cache-billing — 上下文缓存计费与总费用（原链位 10）

> 功能主题：`usage` — 上下文缓存计费与用量聚合显示（`pr-prepare/usage/`）｜ PR 分支 `usage-billing`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/usage/usage-cache-billing-patch1.patch`（7 文件 +311−30）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 10 | `cache-billing` | 七 上下文缓存与计费显示 |

## 明细

### 原链位 10 — `cache-billing`

- 需求背景：旧 fork 的「缓存命中率」用全会话累计口径（`cacheRead / 全会话 prompt`），长 agent 会话每轮重放前文 prompt，累计比值被历史轮稀释到 ~0.5%，与当前缓存实际表现严重不符。用户拍板要求三处全做（header 费用徽标 + 上下文指示器缓存尾巴 + 上下文面板详情行），并按新源码重新设计融合效果；货币 USD/CNY 双显示（CNY = USD × 7.2 固定汇率，仅展示非计费换算）。
- 方案：
  - `sessionUsageMetrics.ts` 新增 `latestTurnCacheHitRate`——请求级口径 `cacheRead / (input + cacheRead + cacheWrite)`，promptTokens=0 返回 null；新增 `CNY_PER_USD = 7.2`、`formatCnyCost`（>0.5 两位小数否则四位，与 USD 同精度）、`formatCompactTokens`。
  - `ContextUsageIndicator.tsx` 从 `displayContext?.apiUsage` 派生最新轮命中率，环形按钮旁增缓存命中尾巴（橙色 #ea580c，无数据不显示）；详情面板 `sessionStats` 以最新轮命中率为首、回退会话累计。
  - `ContextUsageDetails.tsx` 统计行增 cacheReadTokens + totalCostUSD，费用行旁加 CNY。
  - `LocalSlashCommandPanel.tsx` `ContextOverview` 头部增 `98% cached`，第 4 个 pill 在有 cache 时换为命中行。
  - 新增 `SessionCostBadge.tsx`：会话 header 费用徽标，挂载读一次 `getSessionUsage`（`usageOnly` 廉价轮询路径），`produced=0` 不显示，active 时 10s 轮询 + inFlight 防堆叠，双币（移动端 compact 仅 USD）。挂载于桌面 `ActiveSession.tsx` 与移动 `AppShell.tsx`。
  - i18n 5 语言共 4 个新 key（`slash.inspector.context.cache/.cached`、`contextIndicator.cacheHint`、`session.totalCost`）。
  - 子优化（decode-only 速度口径）：分母原用 `totalAPIDuration`（含 TTFT 首 token 等待）致面板速度偏低 ~24%，改为 `decodeMs > 0 ? decodeMs : apiMs`。
- 验证：桌面 tsc -b 0；受影响 4 测试文件 84/84，全量前端 vitest 6143 pass / 2 fail（2 条基线既有，零回归）；dev 7788 live 双端验证费用徽标 `$0.87 · ¥6.27`、缓存尾巴 96.7%、速度 61tok/s（改前 46.2）；含布局微调（尾巴相对按钮定位、popover 384px + flex justify-evenly 等距）逐项 live 像素级确认。
