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
function readPersistedLocale(): string | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(localePreferencesPath(), 'utf8'),
    ) as Record<string, unknown> | null
    const value = parsed?.[LOCALE_FIELD]
    return typeof value === 'string' && value.trim() ? value : null
  } catch {
    // No preferences yet, or unreadable: English, which needs no override.
    return null
  }
}

let cached: PromptLanguage | null = null

/** The language built-in prompts are rendered in for this process. */
export function getPromptLanguage(): PromptLanguage {
  if (cached === null) cached = resolvePromptLanguage(readPersistedLocale())
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
  return cached
}

/** Test seam: forget the cached language so the next read re-resolves it. */
export function resetPromptLanguageCacheForTests(): void {
  cached = null
}
