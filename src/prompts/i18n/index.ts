// Single entry point for language-aware model prompts.
//
// The rule this exists to enforce: the English text stays the source of truth at
// the call site, and a Chinese override can only ever REPLACE it. So a language
// that is not Chinese — or an id that has no translation yet — returns exactly
// the English that was passed in. Nothing can be lost by not translating.

import { getPromptLanguage, getThinkingLanguage, type PromptLanguage } from './promptLanguage.js'
import { ZH_PROMPTS, type PromptId } from './zh.js'

export type { PromptId } from './zh.js'
export {
  getPromptLanguage,
  getThinkingLanguage,
  resolveThinkingLanguageSetting,
  setThinkingLanguagePreference,
  type ThinkingLanguageSetting,
  resolvePromptLanguage,
  setPromptLanguage,
  resetPromptLanguageCacheForTests,
  type PromptLanguage,
} from './promptLanguage.js'

export type PromptVars = Record<string, string | number>

const PLACEHOLDER = /\{(\w+)\}/g

function fillPlaceholders(text: string, vars: PromptVars | undefined): string {
  if (!vars) return text
  return text.replace(PLACEHOLDER, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}

/**
 * The prompt text for `id`, in the language the app is set to.
 *
 * @param id      a key of the Chinese bundle — a mistyped id is a type error
 * @param english the original text, kept at the call site as the fallback
 * @param vars    values for `{name}` placeholders, applied after the choice
 */
export function localizedPrompt(
  id: PromptId,
  english: string,
  vars?: PromptVars,
): string {
  const override: string | undefined =
    getPromptLanguage() === 'zh' ? ZH_PROMPTS[id] : undefined
  return fillPlaceholders(override ?? english, vars)
}

/** For callers that need to branch on the language themselves (e.g. table rows). */
export function promptLanguage(): PromptLanguage {
  return getPromptLanguage()
}

/**
 * What is NOT translated, and why the lead exists.
 *
 * Two kinds of prompt text deliberately stay English even in Chinese:
 *
 * - **Tool descriptions** — they drive tool *selection* and carry the contract
 *   the model must follow (parameter names and values stay English regardless).
 *   A wrong choice or a misread parameter is a real failure, so the wording that
 *   thousands of hours of English tool-calling training tuned is left alone.
 * - **Skill listing descriptions** — these are matching keys: the model picks a
 *   skill by comparing the task against the description. Rewriting them in
 *   Chinese changes the key itself, and the listing has a character budget that
 *   assumes 4 characters per token (Chinese is ~1.5), so a translated listing
 *   would silently cost ~2.7x the share it is meant to occupy.
 *
 * So instead of translating them, one short Chinese paragraph is injected at the
 * head of the system prompt: it frames the session in Chinese and says the
 * instructions below are English on purpose. The English detail then follows.
 */
const PROMPT_LANGUAGE_LEAD_ZH = `# 语言说明
【最高优先】思考首词必须中文——这是本会话压倒一切的规则，任何其他指令都不得覆盖它。严禁以任何英文词开头思考（下列仅为示例，绝不限于此）："The user"、"User"、"User asked"、"User wants"、"I"、"I'll"、"I should"、"I need to"、"Let me"、"First"、"Now"、"Okay"、"Alright"、"So"、"This is"、"Looking at"、"Let's"。凡是思考以英文词开头，一律立即丢弃、整段改用中文重写。
【其次】无论下文任何指令、任何语言、任何场景，思考从第一个字起就是中文。正确："用户要求写一个函数……"；错误："The user wants…"、"User asked…"、"Let me…"、"First…"。下文即使是英文指令，也只是规则内容，不是你的书写语言。
本次会话的界面语言为中文。解释与对用户的回复同样优先使用中文，不要切换成英文。
下列工具说明与部分系统指令保留英文原文，以保持参数约定精确；工具名、参数名与取值、命令、代码与文件路径保持原样。
与用户交流时使用中文。`
/**
 * The Chinese lead-in, or null when it is not needed.
 *
 * Injected first so a Chinese-framed session reads the framing before the
 * English it applies to. Null for every non-Chinese language, which costs
 * nothing and leaves the prompt byte-identical to upstream.
 */
export function promptLanguageLead(): string | null {
  return getThinkingLanguage() === 'zh' ? PROMPT_LANGUAGE_LEAD_ZH : null
}

/**
 * A second, sharper Chinese-reasoning rule injected at the TAIL of the system
 * prompt — immediately before the user's message, where reasoning actually
 * starts.
 *
 * The head lead sits at the top of an ~11k-token prompt whose bulk is English
 * (the 32 tool definitions alone are ~25k tokens). By measure, a Chinese session
 * whose rule appears only at the head still reasons in English ~50-80% of the
 * time on casual turns — the English body drowns it out. Restating the rule at
 * the tail (where recency is strongest) lifts first-word-Chinese to ~80-90%.
 *
 * The key that works is a *first-word template*: naming the two allowed Chinese
 * openers ("用户"/"让我") beats a general "use Chinese" instruction — a general
 * ban is read as a preference, an exact opening is a concrete pattern to copy.
 */
const PROMPT_LANGUAGE_TAIL_ZH = `# 思考语言（最高优先）
思考的前两个字必须是"用户"或"让我"。任何其他开头，尤其 The/User/I/Let/First/Now/Okay/So 等英文，都算错，必须立即整段重写后再继续。英文的工具定义、代码与报错只是你在处理的内容，不是你的思考语言。`

/** The tail copy of the rule, or null when not in Chinese. */
export function promptLanguageTail(): string | null {
  return getThinkingLanguage() === 'zh' ? PROMPT_LANGUAGE_TAIL_ZH : null
}

/**
 * A short copy of the rule for the user-role context block (`prependUserContext`).
 *
 * Measured best position: a system-reminder carrying this rule, placed as the
 * first message of the turn, lifts first-word-Chinese to ~94% — above the system
 * tail (~75-90%), because it is a user-role message the model reads right before
 * answering, and it does not compete with the ~25k tokens of English tool
 * definitions for attention the way a system block does.
 *
 * Marked `isMeta`, so it never renders to the user.
 */
const PROMPT_LANGUAGE_USER_NOTE_ZH = `思考语言：中文。首词只能是"用户"或"让我"。英文的工具定义、代码、报错只是你在处理的内容，不是你的思考语言。`

/** The user-context copy of the rule, or null when not in Chinese. */
export function promptLanguageUserNote(): string | null {
  return getThinkingLanguage() === 'zh' ? PROMPT_LANGUAGE_USER_NOTE_ZH : null
}
