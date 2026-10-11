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
# 内置提示词中文化基础设施（v1 打样）：zh 覆盖表 + localizedPrompt，主系统提示词/收尾/compact/autoDream/review/team/三个内置 agent；
# 含 locale 管道（desktop-ui.json.locale → 侧车）。28 文件（24 改 + 4 新 src/prompts/i18n/*）。
# 独立应用（干净 `cb7065b1e` 上 apply ⇒ 28 文件逐字节一致）。
patches/prompt/prompt-i18n-localization-patch1.patch

# 40：⚠️ 基座同上（0.6.7 血缘）—— = `align-latest`，**独立应用**。
# H5 模型配置补齐测试/获取按钮：删 ProviderSettings 3 处 !browserMode 门控（行内 Test / 获取模型 / 测试连接）+ 测试。3 文件。
patches/h5/h5-provider-test-buttons-patch1.patch

# 41：⚠️ 基座 = `prompt-i18n-localization-patch1.patch` **应用之后**的状态（链式增量，**非**独立基座，必须紧跟 patch1 之后应用）。
# 第二版中文提示词优化（产前实验期）：① lead 从单词级禁改替换规则（"The user is asking"→"用户在问"等 8 条，97.8% 中文思考，17 变体 320 次/变体实测）；
# ② 修 memdir 5 个 section 模块顶层常量固化 bug（import 时 `localizedPrompt` 固化英文，运行时 `setPromptLanguage('zh')` 后记忆段仍全英文）→ 改 `buildXxxSection()` 调用时求值，记忆段 0→2392 汉字。
# 增量链：`cb7065b1e` + patch1 + patch2 ⇒ 6 文件与 `eb6cb0cf0` 逐字节一致（i18n/index.ts + i18n.test.ts + memdir/memoryTypes.ts + memdir/memdir.ts + teamMemPrompts.ts + extractMemories/prompts.ts）。
patches/prompt/prompt-i18n-localization-patch2.patch
# 42：基座 = `prompt-i18n-localization-patch2.patch` 应用之后（链式增量，必须紧跟 patch2）。
# CLI 系统提示词身份前缀中文化（memdir 同款模块常量固化 bug）：三前缀常量 + CLI_SYSPROMPT_PREFIXES 集合都是顶层 const，import 时固化英文。
# 改 build 函数运行时求值 + 集合改 getCliSyspromptPrefixSet() + api.ts 三处 .has() 改局部常量 + zh.ts 新增 3 条 system.cliPrefix.* id。
# 独立链：cb7065b1e + patch1 + patch2 + patch3 ⇒ 3 文件与 8572193e9 逐字节一致。
patches/prompt/prompt-i18n-localization-patch3.patch
