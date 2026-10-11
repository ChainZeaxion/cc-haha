# 11-thinking-switch — 思考模式二级开关：think 是否回传后端 API（链位 11，11-thinking-switch.patch）

> 功能组：pr-2 — 会话基础功能（导出/刷新/禁止更新/思考开关）（pr-prepare/pr-2/）
> 链位 11，patch `11-thinking-switch.patch`（本目录）

- 需求背景：CC-HAHA 默认把上一轮 thinking 全文发回后端（Anthropic 格式原样透传，1P/Bedrock/Vertex 还发 `context_management clear_thinking keep:'all'`）。对自建 vLLM（无 1P 缓存保留机制）= 每轮实打实的额外 prefill token 开销。本项在「设置-通用-思考模式」下新增二级开关「将思考内容回传后端 API」，升级后默认行为翻转（不再回传，省 token）；发现质量回退可打开开关或 `CC_HAHA_SEND_THINKING_HISTORY=1` 恢复。
- 方案（默认关=剥离；本地留存不变——内存滚动/jsonl 落盘/会话内回看始终完整保留 thinking）：
  - `src/utils/settings/types.ts`：新增 `sendThinkingHistory: z.boolean().optional()`（须进 schema，文件校验 `.strict()` 会 strip 未知字段）。
  - `src/utils/thinking.ts`：新增 `shouldSendThinkingToAPI()`（env 强开为调试逃生门 → 否则读 settings `=== true`）。
  - `src/utils/messages.ts`：`normalizeMessagesForAPI` 加第 4 参 `options?: { stripThinking?: boolean }`，尾部清理链中复用 `stripSignatureBlocks` 模式新增 `stripThinkingBlocksForAPI`（剥 assistant 的 `thinking`/`redacted_thinking` block）；旁路调用方（token 估算/compact 等）不传参 → 零行为变化。
  - 挂载点：`src/services/api/claude.ts`（desktop/CLI/SDK 唯一 API 咽喉点，加第 4 参 + `getAPIContextManagement` 的 `hasThinking` 收敛——开关关时不发无意义的 `clear_thinking keep:'all'`）；`src/services/openaiAuth/fetch.ts` 仅响应方向 `preserveOpenAIReasoning`；`src/server/proxy/handler.ts` DeepSeek `roundTripReasoningContent` 门控。
  - H5 配套：`remoteBrowserPolicy.ts` READ/WRITE 白名单（0.6.6 特有，漏改 H5 PUT 400 + 回弹）；`ConfigTool/supportedSettings.ts` 白名单。
  - 前端：`GeneralSettings.tsx` 思考卡片主 checkbox 后插二级 checkbox（`thinkingEnabled &&` 门控）；i18n 5 语言各 2 条；测试 `thinking.test.ts` +4、`messages.test.ts` +3、`providers.test.ts` 2 个 DeepSeek 用例显式设 env（门控默认关会使它们回归）。
- 验证：server 全量 3330 pass/22 fail 与基线 worktree 逐条一致（零回归）；桌面 `tsc -b` 0、全量前端 vitest 6146 pass/0 fail；行为矩阵（Anthropic 关=剥离且不发 `clear_thinking`/开=原样 + `keep:'all'`，DeepSeek 关=不发 `reasoning_content`/开=发明文，本地历史始终完整）；开关经 `getSettingsWithErrors` 每次请求读取，热更新对下一次请求即生效。
