# 应用顺序（自上而下）
#────────────────────────────────────────
# 1–36：基座 = 上游 068b3ebd（0.6.6 血缘），链终态 = 06scode 树。
patches/h5/h5-access-token-patch1.patch
patches/session/session-export-patch1.patch
patches/h5/h5-settings-parity-patch1.patch
patches/session/session-refresh-patch1.patch
patches/tps/tps-indicator-patch1.patch
patches/session/session-file-download-patch1.patch
patches/session/session-disable-updates-patch1.patch
patches/usage/usage-cache-billing-patch1.patch
patches/session/session-thinking-switch-patch1.patch
patches/test/test-server-test-baseline-patch1.patch
patches/h5/h5-mobile-quick-actions-patch1.patch
patches/vcc/vcc-compactor-patch1.patch
patches/h5/h5-mobile-scheduled-patch1.patch
patches/computer-use/computer-use-connector-linux-patch1.patch
patches/h5/h5-mobile-market-layout-patch1.patch
patches/computer-use/computer-use-linux-patch1.patch
patches/usage/usage-context-usage-anchor-patch1.patch
patches/session/session-gzip-transport-patch1.patch
patches/thinking-subagent/thinking-subagent-thinking-tool-timing-patch1.patch
patches/vcc/vcc-autocompact-window-tiers-patch1.patch
patches/session/session-history-transport-patch1.patch
patches/session/session-baseline-typecheck-patch1.patch
patches/h5/h5-mobile-run-records-patch1.patch
patches/vcc/vcc-compact-dead-import-patch1.patch
patches/usage/usage-session-speed-usage-pairing-patch1.patch
patches/h5/h5-local-index-multi-root-patch1.patch
patches/thinking-subagent/thinking-subagent-split-no-double-count-patch1.patch
patches/session/session-open-speed-patch1.patch
patches/test/test-chapter-27-tests-patch1.patch
patches/vcc/vcc-calibration-scripts-patch1.patch
patches/tps/tps-engine-rewrite-patch1.patch
patches/thinking-subagent/thinking-subagent-subagent-usage-cross-client-patch1.patch
patches/tps/tps-density-estimation-patch1.patch
patches/tps/tps-session-total-patch1.patch
patches/session/session-upstream-session-id-patch1.patch
patches/session/session-local-index-budget-patch1.patch

# 37：⚠️ 基座不同 —— = cchaha-067scode `align-latest` 的 HEAD（0.6.7 血缘），**不可**接到上面 36 条之后。
# 该血缘里本轮触及的文件多数在 068b3ebd 基座中不存在或布局不同（如 `components/workspace/surfaces/document/`），
# 故无法链尾追加；本 patch 独立应用（干净 HEAD 上 apply ⇒ 本轮 66 文件逐字节一致）。
patches/h5/h5-file-open-patch1.patch

# 38：⚠️ 基座同上（0.6.7 血缘）—— = `align-latest` 的 `3a51ef84`，**同样不可**接到 36 条之后。
# 压缩阈值分档改双百分比 + vcc 压缩后保留预算；触及 4 源码 + 2 测试文件。
# 另含 **compact 摘要污染修复**（2026-10-12，`22b997bb9`）：`adapter.ts` 跳过 `isCompactSummary`
#   消息（否则摘要自身的 `- Modified:` 条目被 `extractGoals` 当成 Session Goal 并逐次继承）+
#   `vccCompact.ts` 的 `extractPreviousSummary` 改锚定首个 section 标题（head 已本地化，按英文
#   prefix 剥头会切掉 `[Session Goal]` 本身）。该修复同步刷入 patch 15 的 `adapter.ts` 段。
# 独立应用（干净 `3a51ef84` 上 apply ⇒ 6 文件逐字节一致）✅ 已实测。
patches/vcc/vcc-compaction-retention-budget-patch1.patch

# 39：⚠️ 基座同上（0.6.7 血缘）—— = `align-latest` 的 `cb7065b1e`，**同样独立应用**。
# 内置提示词中文化 + 中文思考（v1 打样 + v22 产前实验期，**合并版**）：zh 覆盖表 + localizedPrompt。
# 覆盖主系统提示词全节（intro/cyberRisk/env/language/outputStyle/会话指引/MCP/记忆段/toneAndStyle/outputEfficiency）+
# 子代理（verification/guide/generalPurpose/explore/plan/default/statusline）+ compact/autoDream/review/team/extractMemories/toolUseSummary/chrome。
# 含 locale 管道（desktop-ui.json.locale → 侧车）：src/server/* + desktop/src/api/desktopUiPreferences.ts + settingsStore.ts。
# 【中文思考】① 三层注入：system 头 lead（promptLanguageLead）+ system 尾首词模板（promptLanguageTail）+
#   user 首条 reminder（promptLanguageUserNote，prependUserContext）；根因＝32 个英文工具定义 ≈25k token 锚定英文思考；
# ② 思考语言开关 thinkingLanguage（auto/zh/en，与界面语言解耦）：侧车 getThinkingLanguage() + 新端点 + 设置页 pill；
# ③ 凡「替换 system」的路径补 lead（子代理 enhanceSystemPromptWithEnvDetails / coordinator 模式 / 主线程 agent）——
#   否则那些路径无中文标记、引擎预填不触发、思考退化英文（子代理带工具实测 1/4→4/4）；
# ④ 「模块顶层 const = localizedPrompt」固化英文 bug 共 10 处修复（memdir 5 section + frontmatter 示例 + 3 个 CLI 身份前缀 +
#   CLI_SYSPROMPT_PREFIXES 集合 + SHUTDOWN_TEAM_PROMPT/BASE_CHROME_PROMPT/CLAUDE_IN_CHROME_SKILL_HINT(_WITH_WEBBROWSER)/
#   AGENT_CREATION_SYSTEM_PROMPT/AGENT_MEMORY_INSTRUCTIONS）。
# ⚠️ 配套**引擎侧**改动（不在本链；引擎侧只改 chat 模板一处，**不随 patch 跟踪**，仅记入引擎优化文档）：
#   `1cat-vllm-v130/patches/1cat-vllm优化文档.md` §opt26（chat template 中文思考预填种子，7 词随机）；
#   两者缺一不可——本 patch 提供中文标记，引擎 patch 据此预填。引擎改后需 `POST :8000/v1/internal/reload`。
# 实测定稿：多轮连续 40/40、长会话 24 轮与 20 轮、工具穿插、子代理带工具 —— 全 100% 中文思考；英文会话零回归。
# 47 文件（39 src/ + 8 desktop/）。独立应用（干净 `cb7065b1e` 上 apply ⇒ 47 文件逐字节一致）。
patches/prompt/prompt-i18n-localization-patch1.patch

# 40：⚠️ 基座 = `53199e3f7`（0.6.7 血缘）—— **独立应用**。
# H5 模型配置补齐测试/获取按钮：删 ProviderSettings 3 处 !browserMode 门控（行内 Test / 获取模型 / 测试连接）+ 测试。
# 2026-10-12 补齐：服务端路由放行（remoteProviderRouteAllowed 的 test/models POST、:id/test）+ 远端回传已存 apiKey。
# 8 文件（3 desktop/ + 5 src/）。干净 `53199e3f7` 上 apply ⇒ 8 文件逐字节一致。
patches/h5/h5-provider-test-buttons-patch1.patch

# 41：⚠️ 基座 = `c71ce319d`（0.6.7 血缘）—— **独立应用**。
# 上下文估算口径统一（2026-10-12）：面板读数与压缩触发判据同源，修「显示超线却不压缩」。
# ① 文本：`roughTokenCountEstimation` 改字符分类模型（CJK 1/1.5、字母词 max(1,len/4.5)、
#   数字 1.0/字符、标点 1/1.2、空白 0）；显式传 bytesPerToken 者保留旧行为。
# ② 图片：由常量 2000 改为按尺寸计价——读 PNG IHDR 取 w×h，第三方引擎 /1024（7 尺寸实测 ≤2.2%）、
#   first-party Anthropic /750（官方文档）；不可读/超限回退 2000，document 保持 2000。
# ③ 触发：`shouldAutoCompact` 改 max(tokenCountWithEstimation, 本地全量 + 前缀)，任一超线即触发；
#   新增 EXACT_CONFIRM_BAND=0.1 —— 估算落在阈值 ±10% 内时调引擎 `count_tokens` 取精确值
#   （字符分类建模不了 BPE：同构成实测 1.5–4.5 字符/token 浮动）。
# ④ SessionMemory 截断由「字符 ≈ token×4」改为按 token（`estimateTokensByCharClass`）。
# 刻意未做：用引擎 usage 对本地估算做 EMA 校准 —— 会在引擎少报时拉低估算、掩盖该触发的情形。
# 4 源码 + 6 测试（10 文件）。干净 `c71ce319d` 上 apply ⇒ 10 文件逐字节一致 ✅ 已实测。
patches/usage/usage-context-estimation-patch1.patch
