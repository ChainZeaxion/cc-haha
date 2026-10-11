// Single entry point for language-aware model prompts.
//
// The rule this exists to enforce: the English text stays the source of truth at
// the call site, and a Chinese override can only ever REPLACE it. So a language
// that is not Chinese — or an id that has no translation yet — returns exactly
// the English that was passed in. Nothing can be lost by not translating.

import { getPromptLanguage, type PromptLanguage } from './promptLanguage.js'
import { ZH_PROMPTS, type PromptId } from './zh.js'

export type { PromptId } from './zh.js'
export {
  getPromptLanguage,
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
本次会话的界面语言为中文。为保持措辞与参数约定的精确，下列系统指令、工具说明与技能描述一律使用英文原文，不做翻译；请严格按原文遵循，并保持工具名、参数名与参数取值、命令、代码与文件路径原样。
与用户交流时使用中文。`

/**
 * The Chinese lead-in, or null when it is not needed.
 *
 * Injected first so a Chinese-framed session reads the framing before the
 * English it applies to. Null for every non-Chinese language, which costs
 * nothing and leaves the prompt byte-identical to upstream.
 */
export function promptLanguageLead(): string | null {
  return getPromptLanguage() === 'zh' ? PROMPT_LANGUAGE_LEAD_ZH : null
}
