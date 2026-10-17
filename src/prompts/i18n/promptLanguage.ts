// Which language the built-in model prompts are written in.
//
// English is the source of truth and lives at each call site; this layer only
// decides whether a Chinese override is used instead. Nothing here is needed for
// the English path, so a missing override can never lose the original text.

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export type PromptLanguage = 'en' | 'zh'

/**
 * `zh`, `zh-CN`, `zh-TW`, `zh-Hant` … all count as Chinese.
 *
 * The desktop UI keeps Traditional and Simplified as separate translations, but a
 * prompt written in either is Chinese. This matches the title service, which
 * normalizes every `zh-*` tag to Chinese.
 */
export function resolvePromptLanguage(locale: unknown): PromptLanguage {
  if (typeof locale !== 'string') return 'en'
  const value = locale.trim().toLowerCase()
  if (!value) return 'en'
  if (value === 'zh' || value.startsWith('zh-') || value.startsWith('zh_')) return 'zh'
  if (value === '中文' || value === 'chinese') return 'zh'
  return 'en'
}

const LOCALE_FIELD = 'locale'
const PROMPT_LANGUAGE_FIELD = 'promptLanguage'

function localePreferencesPath(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  return path.join(configDir, 'cc-haha', 'desktop-ui.json')
}

/**
 * The locale the client last persisted.
 *
 * Read straight from the preferences file rather than through the preferences
 * service: prompt builders run deep inside request handling, and one small
 * synchronous read at most once per process keeps that path free of new awaits.
 */
function readPersistedRaw(field: string): unknown {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(localePreferencesPath(), 'utf8'),
    ) as Record<string, unknown> | null
    return parsed?.[field] ?? null
  } catch {
    // No preferences yet, or unreadable: English, which needs no override.
    return null
  }
}

function readPersistedPreference(field: string): string | null {
  const value = readPersistedRaw(field)
  return typeof value === 'string' && value.trim() ? value : null
}

let cached: PromptLanguage | null = null
/** The locale a write path last set — mirrors `locale` without a file read. */
let localeOverride: PromptLanguage | null = null
/**
 * The prompt-language setting a write path last set — mirrors `promptLanguage`
 * without a file read. Null while only the persisted file has a value.
 */
let settingOverride: PromptLanguageSetting | null = null

/**
 * The "system prompt language" setting: `auto` derives it from the UI locale
 * (the original behaviour), `zh`/`en` pin it regardless of the locale.
 */
export type PromptLanguageSetting = 'auto' | 'zh' | 'en'

export function resolvePromptLanguageSetting(raw: unknown): PromptLanguageSetting {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return value === 'zh' || value === 'en' ? value : 'auto'
}

/** The language built-in prompts are rendered in for this process. */
export function getPromptLanguage(): PromptLanguage {
  if (cached !== null) return cached
  const setting = settingOverride ??
    resolvePromptLanguageSetting(readPersistedPreference(PROMPT_LANGUAGE_FIELD))
  cached = setting === 'auto'
    ? (localeOverride ?? resolvePromptLanguage(readPersistedPreference(LOCALE_FIELD)))
    : setting
  return cached
}

/**
 * Record a locale change.
 *
 * Called on the write path so a long-lived sidecar follows the setting without a
 * restart, and so no reader ever has to observe a half-written file. The passed
 * locale only takes effect when no manual prompt-language setting pins it —
 * that is exactly the `auto` contract.
 */
export function setPromptLanguage(locale: unknown): PromptLanguage {
  localeOverride = resolvePromptLanguage(locale)
  cached = null
  // The reasoning language may be "auto", i.e. derived from the locale — drop
  // its cache so the next read re-derives from the new locale.
  cachedThinking = null
  return getPromptLanguage()
}

/**
 * Record a system-prompt-language change. `auto` defers to the UI locale.
 *
 * Also drops the thinking cache: an `auto` thinking setting follows the prompt
 * language, and a manual `zh`/`en` prompt switch changes what that resolves to.
 */
export function setPromptLanguageSetting(raw: unknown): PromptLanguage {
  settingOverride = resolvePromptLanguageSetting(raw)
  cached = null
  cachedThinking = null
  return settingOverride === 'auto' ? getPromptLanguage() : settingOverride
}

/** Test seam: forget the cached language so the next read re-resolves it. */
export function resetPromptLanguageCacheForTests(): void {
  cached = null
  cachedThinking = null
  cachedToolTurnThinking = null
  localeOverride = null
  settingOverride = null
}

// ── Reasoning (thinking) language ──────────────────────────────────────────
//
// Separate from the *prompt* language on purpose. The prompt body follows the
// "system prompt language" setting (which itself defaults to the UI locale);
// the reasoning language is what the model thinks in, and a user may want it
// pinned regardless — e.g. an English UI but Chinese thinking.

const THINKING_FIELD = 'thinkingLanguage'

/** `auto` follows the prompt language; `zh`/`en` pin the reasoning language. */
export type ThinkingLanguageSetting = 'auto' | 'zh' | 'en'

export function resolveThinkingLanguageSetting(raw: unknown): ThinkingLanguageSetting {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return value === 'zh' || value === 'en' ? value : 'auto'
}

let cachedThinking: PromptLanguage | null = null

/**
 * The language the model should reason in.
 *
 * `auto` (the default) mirrors the prompt language, preserving prior behaviour.
 */
export function getThinkingLanguage(): PromptLanguage {
  if (cachedThinking === null) {
    const setting = resolveThinkingLanguageSetting(readPersistedPreference(THINKING_FIELD))
    cachedThinking = setting === 'auto' ? getPromptLanguage() : setting
  }
  return cachedThinking
}

/** Record a reasoning-language change (the write path, like setPromptLanguage). */
export function setThinkingLanguagePreference(raw: unknown): PromptLanguage {
  const setting = resolveThinkingLanguageSetting(raw)
  cachedThinking = setting === 'auto' ? getPromptLanguage() : setting
  return cachedThinking
}

// ── Tool-turn thinking (enable_thinking skip) ───────────────────────────────
//
// Whether the assistant keeps thinking between tool turns on a self-hosted
// engine. OFF (the default) sends `chat_template_kwargs.enable_thinking=false`
// on tool-continuation turns so the engine skips its thinking preamble; ON
// keeps the engine default and the request carries no such field.

const TOOL_TURN_FIELD = 'toolTurnThinking'

/** `true` only when the stored value is the literal boolean true. */
export function resolveToolTurnThinkingSetting(raw: unknown): boolean {
  return raw === true
}

let cachedToolTurnThinking: boolean | null = null

/**
 * Whether tool-continuation turns should think. The default is `false` (skip):
 * a missing or invalid stored value means skip thinking between tools.
 */
export function getToolTurnThinking(): boolean {
  if (cachedToolTurnThinking === null) {
    cachedToolTurnThinking = resolveToolTurnThinkingSetting(
      readPersistedRaw(TOOL_TURN_FIELD),
    )
  }
  return cachedToolTurnThinking
}

/** Record a tool-turn-thinking change (the write path, like the language ones). */
export function setToolTurnThinkingPreference(raw: unknown): boolean {
  cachedToolTurnThinking = resolveToolTurnThinkingSetting(raw)
  return cachedToolTurnThinking
}
