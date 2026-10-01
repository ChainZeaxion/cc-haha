# pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）

- 上游文档章节：四/二十八.1/二十八.4
- 建议分支：`pr/tps-indicator`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 7 | `items/07-tps-indicator/07-tps-indicator.patch` | +776/−7 | 8 | 四 TPS 指示器 + 两行 + 子代理汇聚 + 展示格式/4 位封顶（#90） |
| 30 | `items/30-tps-centered-second-line/30-tps-centered-second-line.patch` | +6/−3 | 2 | 四 费用/TPS **保持上下两行**，TPS 由右对齐改**第二行居中**（桌面 `ActiveSession.tsx` + H5 `AppShell.tsx`） |
| 35 | `items/35-tps-real-token-accounting/35-tps-real-token-accounting.patch` | +1184/−52 | 20 | 四 子优化：**TPS 采样改真实 token 口径**——自适应三层源（ids/chunk/char）+ 真实 `output_tokens` 对账校准 + 按模型分桶持久化 + 引擎 `return_token_ids` 旁路（20 文 |
| 38 | `items/38-tps-content-accounting/38-tps-content-accounting.patch` | +369/−252 | 8 | 四 子优化：**TPS 计量改为按内容度量**（CJK/latin 两系数最小二乘 + `ids` 独占；废弃按帧计数的 chunk 层——6 并发子代理下它把读数抬到真实值 2~3 倍的根因） |
| 42 | `items/42-tps-burst-anchor/42-tps-burst-anchor.patch` | +175/−5 | 2 | 四 子优化⑤：**TPS 脉冲修复**——`value()` 缺「刚滑出窗口的样本」锚（`preWindowAt`），流切换处窗口塌缩时积压 token 被 400ms 地板除 ⇒ 生产实测爆到 1000-2000 t/s（真值 230-2 |
| 44 | `items/44-tps-tokens-kind-and-reasoning-passthrough/44-tps-tokens-kind-and-reasoning-passthrough.patch` | +232/−30 | 12 | 四 子优化⑥：`tps_tokens` 带 **kind**（thinking/content/tool）供思考徽章取**精确单块** token（转录无此字段，只能估）；代理层透传 `reasoning_tokens`（兼容 vLLM ` |
| 50 | `items/50-tps-phase-switch-steady-window/50-tps-phase-switch-steady-window.patch` | +156/−53 | 2 | 四 子优化⑦：**TPS 相位切换脉冲真根因**——`total` 与 `span` 不是同一批 token 的时间：锚的条件太窄（停滞冲刷恰落在 `span==400ms` 地板故不进锚）、无前置样本时 `Math.max(span, 4 |
| 54 | `items/54-tps-batched-delivery/54-tps-batched-delivery.patch` | +209/−16 | 4 | 四 补记二：**TPS 上千读数真因＝打包投递被当成生成节奏**——重放/整块交付/页面忙时排队的中转帧，其 token 生成时刻远早于投递时刻；逐样本只计入「到达间隔能支撑其实时速率」的样本（上限 5000），延迟交付的首批保留自身间隔故 |
| 62 | `items/62-tps-bucket-engine-rewrite/62-tps-bucket-engine-rewrite.patch` | +1619/−998 | 19 | 二十八 28.1：**TPS 速率引擎重写为 125ms 分桶**——按用户 5 条规格推倒旧连续滑窗（`sliceRate`/`SETTLE_MS`/`BURST_FLOOR_MS`/`MAX_INSTANT_TPS`/`preWindo |
| 64 | `items/64-tps-background-freeze/64-tps-background-freeze.patch` | +244/−11 | 4 | 二十八 28.4：**后台标签页切回后 TPS 飙高 / 卡着不动**——浏览器后台节流 JS，切回时整段积压**在同一瞬间交付**，落进同一个到达 125ms 桶（60s 冻结 ⇒ 6240 token/桶 ≈ 单桶 50k t/s）；而 |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「四」：自第 307 行起
- 章节「二十八」：自第 2435 行起

## 文件清单

- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/sessions.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/subagents.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/ExportConversationDialog.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/activity/SessionActivityPanel.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/activity/sessionActivityModel.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ActivityGroup.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/DownloadReferencesCard.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/MessageList.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/components/chat/MobileQuickActions.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/SessionCostBadge.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ThinkingBlock.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ToolCallGroup.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/TpsIndicator.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/TpsIndicator.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/TurnCompletionStamp.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/activityGroupModel.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/layout/AppShell.test.tsx` （本组 patch 直接改动）
- `desktop/src/components/layout/AppShell.tsx` （本组 patch 直接改动）
- `desktop/src/components/layout/Sidebar.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/hooks/useCompactMetrics.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/i18n/locales/en.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/jp.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/kr.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh-TW.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/i18n/locales/zh.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/lib/desktopRuntime.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/downloadFileMeta.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/fileSizeCache.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/handlePreviewLink.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/sessionExport.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/sessionUsageMetrics.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/tpsCalibration.test.ts` （本组 patch 直接改动）
- `desktop/src/lib/tpsCalibration.ts` （本组 patch 直接改动）
- `desktop/src/lib/tpsMeter.test.ts` （本组 patch 直接改动）
- `desktop/src/lib/tpsMeter.ts` （本组 patch 直接改动）
- `desktop/src/lib/turnCompletion.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/pages/ActiveSession.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/pages/SubagentRunPage.tsx` （本组 patch 直接改动）
- `desktop/src/stores/chatStore.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/stores/chatStore.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/chat.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/types/session.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `src/server/__tests__/proxy-transform.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/websocket-handler.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/index.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/proxy/handler.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/proxy/streaming/openaiChatStreamToAnthropic.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/proxy/streaming/openaiChatStreamToAnthropic.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/proxy/tpsTokenSink.ts` （本组 patch 直接改动）
- `src/server/proxy/transform/anthropicToOpenaiChat.ts` （本组 patch 直接改动）
- `src/server/proxy/transform/requestCompatibility.test.ts` （本组 patch 直接改动）
- `src/server/proxy/transform/requestCompatibility.ts` （本组 patch 直接改动）
- `src/server/proxy/transform/types.ts` （本组 patch 直接改动）
- `src/server/proxy/transform/usage.ts` （本组 patch 直接改动）
- `src/server/types/provider.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/ws/events.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/ws/handler.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
