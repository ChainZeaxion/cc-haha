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
function readPersistedPreference(field: string): string | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(localePreferencesPath(), 'utf8'),
    ) as Record<string, unknown> | null
    const value = parsed?.[field]
    return typeof value === 'string' && value.trim() ? value : null
  } catch {
    // No preferences yet, or unreadable: English, which needs no override.
    return null
  }
}

let cached: PromptLanguage | null = null

/** The language built-in prompts are rendered in for this process. */
export function getPromptLanguage(): PromptLanguage {
  if (cached === null) cached = resolvePromptLanguage(readPersistedPreference(LOCALE_FIELD))
  return cached
}

/**
 * Record a locale change.
 *
 * Called on the write path so a long-lived sidecar follows the setting without a
 * restart, and so no reader ever has to observe a half-written file.
 */
export function setPromptLanguage(locale: unknown): PromptLanguage {
  cached = resolvePromptLanguage(locale)
  // The reasoning language may be "auto", i.e. derived from the locale — drop
  // its cache so the next read re-derives from the new locale.
  cachedThinking = null
  return cached
}

/** Test seam: forget the cached language so the next read re-resolves it. */
export function resetPromptLanguageCacheForTests(): void {
  cached = null
  cachedThinking = null
}

// ── Reasoning (thinking) language ──────────────────────────────────────────
//
// Separate from the *prompt* language on purpose. The prompt body follows the UI
// locale (translate the built-in prompts or not); the reasoning language is what
// the model thinks in, and a user may want it pinned regardless of UI language —
// e.g. an English UI but Chinese thinking.

const THINKING_FIELD = 'thinkingLanguage'

/** `auto` follows the UI locale; `zh`/`en` pin the reasoning language. */
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
