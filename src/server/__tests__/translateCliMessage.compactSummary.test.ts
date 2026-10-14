import { expect, test } from 'bun:test'
import {
  isCompactSummaryMessageContent,
  looksLikeCompactSummaryContent,
} from '../ws/cliMessageParsing.js'
import { translateCliMessage } from '../ws/handler.js'

const EN_PREFIX =
  'This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.'
const ZH_PREFIX = '本会话由一段超出上下文的先前对话继续而来。下方摘要覆盖了对话较早的部分。'

test('isCompactSummaryMessageContent recognizes both head sentences', () => {
  expect(isCompactSummaryMessageContent(`${EN_PREFIX}\n\n[Session Goal]`)).toBe(true)
  expect(isCompactSummaryMessageContent(`${ZH_PREFIX}\n\n[Session Goal]\n- ...`)).toBe(true)
  expect(isCompactSummaryMessageContent('regular user prompt')).toBe(false)
})

test('the flag beats the text anchor regardless of head language', () => {
  // A future head sentence in yet another locale must still be recognized.
  expect(isCompactSummaryMessageContent('Résumé de la session…', true)).toBe(true)
  expect(isCompactSummaryMessageContent('Résumé de la session…')).toBe(false)
})

test('section headers anchor a summary whose head sentence is unknown', () => {
  expect(looksLikeCompactSummaryContent('[Session Goal]\n- ship it')).toBe(true)
  expect(looksLikeCompactSummaryContent('[Files And Changes]\n- adapter.ts')).toBe(true)
  expect(looksLikeCompactSummaryContent('plain text mentioning [Session Goal] inline')).toBe(false)
})

test('translateCliMessage turns a Chinese summary frame into a compact_summary card', () => {
  const messages = translateCliMessage(
    {
      type: 'user',
      isCompactSummary: true,
      message: { role: 'user', content: `${ZH_PREFIX}\n\n[Session Goal]\n- 修复摘要识别` },
    },
    'summary-session',
  )
  expect(messages).toHaveLength(1)
  expect(messages[0]).toMatchObject({ type: 'system_notification', subtype: 'compact_summary' })
})

test('translateCliMessage without the flag still recognizes the Chinese head', () => {
  const messages = translateCliMessage(
    {
      type: 'user',
      message: { role: 'user', content: `${ZH_PREFIX}\n\n[Session Goal]\n- 修复摘要识别` },
    },
    'summary-session',
  )
  expect(messages.some(m => (m as { subtype?: string }).subtype === 'compact_summary')).toBe(true)
})
