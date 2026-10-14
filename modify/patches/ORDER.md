# 应用顺序（自上而下）
#════════════════════════════════════════
# 2026-10-14 重排：45 → 15。原 45 个单优化项 patch 合并为「8 个域 bundle（段一）+ 7 个独立项（段二）」。
# 被合并的原文件在 modify/archive/patches-merged-20261014/（含合并映射表）。
#────────────────────────────────────────
# 【段一】8 个域 bundle，基座 = 上游 068b3ebd（0.6.6 血缘），自上而下连续 apply，
# 终态 = 06scode 树。权威校验：干净 068b3ebd 上连续 apply 8 条 ⇒ git tree = 42905e42f，
# 与原 36 条链终态树逐字节一致（diff 零字节）✅ 2026-10-14 实测。
# 域内顺序 = 原 ORDER 链序；跨域文件（28 个）归属最先应用域，故 bundle 应用顺序不可调换。
#────────────────────────────────────────
patches/h5/h5-bundle-patch1.patch
patches/session/session-bundle-patch1.patch
patches/tps/tps-bundle-patch1.patch
patches/usage/usage-bundle-patch1.patch
patches/test/test-bundle-patch1.patch
patches/vcc/vcc-bundle-patch1.patch
patches/computer-use/computer-use-bundle-patch1.patch
patches/thinking-subagent/thinking-subagent-bundle-patch1.patch

#════════════════════════════════════════
# 【段二】7 个独立 patch，基座 = 0.6.7 血缘的 `3a51ef84`（与段一平行，**不可**接在段一终态之后——
# h5-file-open 的 66 文件中 56 个在 068b3ebd 基座不存在或布局不同）。
# 自上而下连续 apply，终态 src/+desktop/ = HEAD（7fc522679）。
# 权威校验：干净 3a51ef84 上连续 apply 7 条 ⇒ 与旧 9 条（原 37-45）重放终态树逐字节一致（diff 零字节）✅
# 2026-10-14 实测。与 HEAD 的少量残余差异（SideChat 浮钮/vite proxy 等）来自 63100ded9 建仓提交中
# 不属于 patch 体系的内容，新旧体系完全一致。
#────────────────────────────────────────

# 9：h5-file-open（2026-10-06 起四轮，66 文件）。H5 文件点击页内打开/无 shell 时不落服务端打开/
#    媒体页内播放/打开方式按能力过滤 + 用户显式点击弹移动浮层。
patches/h5/h5-file-open-patch1.patch

# 10：usage-context-estimation（**合并原 38+41**，2026-10-14，14 文件）。
#    原 38（vcc-compaction-retention-budget）：压缩阈值分档改双百分比 + vcc 保留预算；含摘要污染修复
#      （22b997bb9 的 adapter.ts 段，另刷入段一 vcc/prompt bundle）。
#    原 41：上下文估算口径统一——字符分类模型 + 图片按尺寸（PNG IHDR）+ 触发取 max(引擎usage, 本地)
#      + ±10% 邻域 count_tokens 精算 + SessionMemory 按 token 截断。
#    两者同改 shouldAutoCompact 判据（autoCompact{,.test}.ts 重叠），语义一脉合一。
#    干净 3a51ef84 上 apply 后这 14 文件 = 0e219d844（41 落地树）同文件内容 ✅ 逐字节一致。
patches/usage/usage-context-estimation-patch1.patch

# 11：prompt-i18n-localization（48 文件）。内置提示词全量中文化 + 中文思考三层注入 +
#    thinkingLanguage/promptLanguage 双开关 + 引擎预填标记联动。配套引擎侧改动见引擎优化文档 §opt26。
patches/prompt/prompt-i18n-localization-patch1.patch

# 12：h5-provider-test-buttons（8 文件）。H5 模型配置「获取模型/测试连接/行内测试」+ 服务端路由放行。
patches/h5/h5-provider-test-buttons-patch1.patch

# 13：compact-summary-anchor（9 文件）。摘要身份锚点改 isCompactSummary 旗标贯通 SDK 帧/JSONL/desktop，
#    修中文摘要头部句中文化后穿透英文前缀过滤、以全文气泡泄漏。
patches/compact/compact-summary-anchor-patch1.patch

# 14：tps-estimation-unified（**合并原 43+45**，2026-10-14，15 文件）。
#    原 43：TPS 与估算口径统一——流式指示器吃 tps_tokens 真值 + attempt 边界镜像；估算吃密度池 +
#    拟合 EWMA 新近权重；工具期静默读数落 0 + ids 断供 10s 回落。
#    原 45：ids 探测与校准学习——probe 改流结束时判定 + 曾支持永不拉黑 + miss 10 分钟衰减；
#    整块工具输入补喂 meter + 学习样本 4×units 护栏 + 校准 v5→v6 清毒值。
#    同改 tpsMeter/chatStore（3 文件重叠），45 是 43 的延续，合一。
#    干净 d240afe84 上 apply 43+45 后这 15 文件 = HEAD（7fc522679）同文件内容 ✅ 逐字节一致。
patches/tps/tps-estimation-unified-patch1.patch

# 15：workspace-history-budget-degrade（4 文件）。超预算会话（transcript 413）的工作区降级——
#    loadStatus 回落 git-info 保住 workDir，轮次文件卡点行改开文件预览。
patches/workspace/workspace-history-budget-degrade-patch1.patch
