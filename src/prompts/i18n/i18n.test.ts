import { beforeEach, describe, expect, test } from 'bun:test'

import { localizedPrompt, promptLanguageLead, resolvePromptLanguage, setPromptLanguage } from './index.js'
import { ZH_PROMPTS } from './zh.js'

// A stand-in for a real call site: the English as it appears in the source, and
// the same id passed in. Nothing here depends on which prompts exist.
const ID = 'system.systemReminders'
const ENGLISH = '- Tool results and user messages may include <system-reminder> tags.'

describe('resolvePromptLanguage', () => {
  test('any zh tag counts as Chinese, Traditional included', () => {
    for (const locale of ['zh', 'zh-CN', 'zh-TW', 'zh-Hant', 'ZH', 'zh_HK']) {
      expect(resolvePromptLanguage(locale)).toBe('zh')
    }
  })

  test('every other locale, and a missing one, is English', () => {
    for (const locale of ['en', 'en-US', 'jp', 'kr', 'fr', undefined, null, '', '  ', 42]) {
      expect(resolvePromptLanguage(locale)).toBe('en')
    }
  })
})

describe('localizedPrompt', () => {
  beforeEach(() => setPromptLanguage('en'))

  test('hands back the English untouched when the language is not Chinese', () => {
    // The override exists, and is deliberately not used.
    setPromptLanguage('en')
    expect(localizedPrompt(ID, ENGLISH)).toBe(ENGLISH)

    setPromptLanguage('jp')
    expect(localizedPrompt(ID, ENGLISH)).toBe(ENGLISH)
  })

  test('uses the Chinese override when the language is Chinese', () => {
    setPromptLanguage('zh')
    const result = localizedPrompt(ID, ENGLISH)

    expect(result).toBe(ZH_PROMPTS[ID])
    expect(result).not.toBe(ENGLISH)
  })

  test('treats zh-TW as Chinese too', () => {
    setPromptLanguage('zh-TW')
    expect(localizedPrompt(ID, ENGLISH)).toBe(ZH_PROMPTS[ID])
  })

  test('fills placeholders in the chosen text, leaving unknown ones alone', () => {
    setPromptLanguage('en')
    expect(localizedPrompt(ID, 'Run {tool} on {path} of {missing}', { tool: 'grep', path: 'a.ts' }))
      .toBe('Run grep on a.ts of {missing}')

    // A number is as valid as a string.
    setPromptLanguage('en')
    expect(localizedPrompt(ID, 'Kept {count} turns', { count: 3 })).toBe('Kept 3 turns')
  })

  test('falls back to English for an id with no override', () => {
    // The bundle drives the id union, so this cannot happen for a declared id —
    // but the accessor must still be total, since call sites pass English in.
    setPromptLanguage('zh')
    const noOverride = Object.keys(ZH_PROMPTS).includes('system.doesNotExist')
    expect(noOverride).toBe(false)
    expect(localizedPrompt(ID, ENGLISH)).toBe(ZH_PROMPTS[ID])
  })
})

describe('the Chinese lead-in', () => {
  test('is injected for Chinese and absent for everything else', () => {
    setPromptLanguage('zh')
    const lead = promptLanguageLead()
    expect(lead).not.toBeNull()
    expect(lead!).toContain('语言说明')
    // Short by design: it frames what follows, it does not restate it.
    expect(lead!.length).toBeLessThan(600)

    for (const locale of ['en', 'jp', 'kr']) {
      setPromptLanguage(locale)
      expect(promptLanguageLead(), locale).toBeNull()
    }
  })

  test('says the English below is deliberate, so it is not read as untranslated', () => {
    setPromptLanguage('zh')
    expect(promptLanguageLead()).toContain('英文')
  })

  test('forces reasoning to stay Chinese, so English instructions do not pull thinking back to English', () => {
    setPromptLanguage('zh')
    expect(promptLanguageLead()).toContain('思考')
    expect(promptLanguageLead()).toContain('不要切换成英文')
  })

  test('forces the very first word of reasoning to be Chinese, naming the English openings to ban', () => {
    setPromptLanguage('zh')
    expect(promptLanguageLead()).toContain('思考首词必须中文')
    // The banned English openings are named explicitly — measured to be what actually
    // anchors a whole English reasoning run.
    expect(promptLanguageLead()).toContain('The user')
  })
})

describe('the Chinese bundle', () => {
  test('every entry is non-empty Chinese text', () => {
    for (const [id, text] of Object.entries(ZH_PROMPTS)) {
      expect(text.trim().length, id).toBeGreaterThan(0)
      // Han characters present: an English string accidentally pasted as a
      // translation would otherwise pass the emptiness check.
      expect(/[\u4e00-\u9fff]/.test(text), id).toBe(true)
    }
  })

  test('ids are namespaced by area', () => {
    for (const id of Object.keys(ZH_PROMPTS)) {
      expect(id).toMatch(
        /^(system|service|command|agent|memdir|chrome|misc|coordinator)\./,
      )
    }
  })

  test('carries no tool or skill description, which stay English by policy', () => {
    // A tool description is the contract the model follows and the key it picks
    // a tool by; the skill listing is a matching key with a char budget that
    // assumes 4 chars/token. Translating either is a behaviour change, not a
    // translation, so the bundle must not contain them.
    for (const id of Object.keys(ZH_PROMPTS)) {
      // Tool descriptions and skill-listing entries would live under these
      // prefixes. `system.sessionGuidance.skillsShorthand` is a system-prompt
      // bullet ABOUT the Skill tool, not a listing entry, so the prefix is the
      // right test — matching on the substring "skill" would fail it wrongly.
      expect(id.startsWith('tool.'), id).toBe(false)
      expect(id.startsWith('skill.'), id).toBe(false)
    }
  })
})
