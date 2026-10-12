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
# 独立应用（干净 `3a51ef84` 上 apply ⇒ 6 文件逐字节一致）。
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

# 40：⚠️ 基座同上（0.6.7 血缘）—— = `align-latest`，**独立应用**。
# H5 模型配置补齐测试/获取按钮：删 ProviderSettings 3 处 !browserMode 门控（行内 Test / 获取模型 / 测试连接）+ 测试。3 文件。
patches/h5/h5-provider-test-buttons-patch1.patch

