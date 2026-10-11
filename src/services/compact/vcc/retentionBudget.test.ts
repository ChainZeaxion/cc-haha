import { describe, expect, test } from 'bun:test'

import { buildVccCut, resolveSmartKeepUserTurns, type TailAllowance } from './engine.js'
import { runVccCompaction } from './vccCompact.js'

// 4 chars per token, stated rather than calibrated so the arithmetic in the
// expectations is the same arithmetic the code does.
const CALIBRATION = { mode: 'calibrated' as const, charsPerToken: 4 }

/** `turns` turns of `charsPerTurn` chars each, split evenly user/assistant. */
const windowOf = (turns: number, charsPerTurn: number) => {
  const messages: Array<{ role: string; content: string }> = []
  for (let i = 0; i < turns; i++) {
    messages.push({ role: 'user', content: 'u'.repeat(charsPerTurn / 2) })
    messages.push({ role: 'assistant', content: 'a'.repeat(charsPerTurn / 2) })
  }
  return messages
}

const cutOf = (
  messages: Array<{ role: string; content: string }>,
  keepUserTurns: number,
  allowance?: TailAllowance,
) =>
  buildVccCut(
    messages as never,
    messages.map(() => undefined),
    messages.map((_, i) => i),
    keepUserTurns,
    { charsPerToken: CALIBRATION.charsPerToken, tailAllowance: allowance },
  )

const keptTokens = (messages: Array<{ role: string; content: string }>, start: number) =>
  messages
    .slice(start)
    .reduce((total, m) => total + Math.ceil(m.content.length / CALIBRATION.charsPerToken), 0)

/** A cc-shaped window of `turns` turns, `charsPerTurn` chars each. */
const ccWindowOf = (turns: number, charsPerTurn: number) =>
  Array.from({ length: turns * 2 }, (_, i) => {
    const isUser = i % 2 === 0
    return {
      type: isUser ? 'user' : 'assistant',
      uuid: `m${i}`,
      message: {
        role: isUser ? 'user' : 'assistant',
        content: (isUser ? 'u' : 'a').repeat(charsPerTurn / 2),
      },
    }
  })

/** What the context costs once the compaction is in place. */
const resultTokens = (result: { summary: string; messagesToKeep: unknown[] }) =>
  Math.ceil(result.summary.length / CALIBRATION.charsPerToken) +
  result.messagesToKeep.reduce((total, m) => {
    const content = (m as { message: { content: string } }).message.content
    return total + Math.ceil(content.length / CALIBRATION.charsPerToken)
  }, 0)

describe('retained tail under a retention budget', () => {
  test('grows the tail to use the target instead of stopping at a fixed minimum', () => {
    // Five 1k-token turns. A 3k target pays for three of them, and keeping fewer
    // would throw away history the target had already paid for.
    const messages = windowOf(5, 4_000)
    const allowance: TailAllowance = { preferredTokens: 3_000, ceilingTokens: 6_000 }

    const keep = resolveSmartKeepUserTurns(messages as never, CALIBRATION, allowance)

    expect(keep.keepUserTurns).toBe(3)
    expect(keep.smartAdjusted).toBe(true)
  })

  test('keeps the newest turn when it alone exceeds the target', () => {
    // The live turn is never summarized away just because it is large; the
    // ceiling is what decides whether it can be kept at all.
    const messages = windowOf(5, 4_000)
    const allowance: TailAllowance = { preferredTokens: 500, ceilingTokens: 2_000 }

    const keep = resolveSmartKeepUserTurns(messages as never, CALIBRATION, allowance)

    expect(keep.keepUserTurns).toBe(1)
    const cut = cutOf(messages, keep.keepUserTurns, allowance)
    expect(cut.budgetCut).toBe('none')
    expect(keptTokens(messages, cut.keptCcStart)).toBe(1_000)
  })

  test('falls back to the fixed rule when no budget is given', () => {
    // Slice/partial compaction and the pi-vcc parity callers pass no allowance:
    // the kept tail is then only grown while it stays under MAX.
    const messages = windowOf(5, 4_000)

    const keep = resolveSmartKeepUserTurns(messages as never, CALIBRATION)

    // Four, not five: a cut always keeps something before it, so the oldest turn
    // cannot be part of a kept tail.
    expect(keep.keepUserTurns).toBe(4)
  })

  test('cuts the tail back from the end when it exceeds the ceiling', () => {
    // A bulky newest turn — 5k of prompt and a 1k answer — against a 2.5k
    // ceiling. The answer fits; the prompt it answered does not, so the kept
    // region starts at the answer rather than at the turn boundary.
    const messages = [
      ...windowOf(4, 4_000),
      { role: 'user', content: 'u'.repeat(20_000) },
      { role: 'assistant', content: 'a'.repeat(4_000) },
    ]
    const allowance: TailAllowance = { preferredTokens: 1_000, ceilingTokens: 2_500 }

    const keep = resolveSmartKeepUserTurns(messages as never, CALIBRATION, allowance)
    const cut = cutOf(messages, keep.keepUserTurns, allowance)

    expect(cut.budgetCut).toBe('oversized_tail')
    expect(cut.keptCcStart).toBe(9)
    expect(keptTokens(messages, cut.keptCcStart)).toBeLessThanOrEqual(
      allowance.ceilingTokens,
    )
    expect(cut.keptUserTurns).toBe(0)
  })

  test('compacts everything when even the newest message is past the ceiling', () => {
    // Keeping it would leave the context no safer than before compacting, so the
    // budget wins: nothing is kept verbatim and the summary carries the window.
    const messages = [
      ...windowOf(2, 4_000),
      { role: 'user', content: 'u'.repeat(4_000) },
      { role: 'assistant', content: 'a'.repeat(40_000) },
    ]
    const allowance: TailAllowance = { preferredTokens: 1_000, ceilingTokens: 1_500 }

    const keep = resolveSmartKeepUserTurns(messages as never, CALIBRATION, allowance)
    const cut = cutOf(messages, keep.keepUserTurns, allowance)

    expect(cut.budgetCut).toBe('oversized_tail')
    expect(cut.keepFallbackToCompactAll).toBe(true)
    expect(cut.keptCcStart).toBe(messages.length)
    expect(cut.toSummarize).toHaveLength(messages.length)
  })

  test('leaves the whole context inside the ceiling end to end', () => {
    // Twelve 1k-token turns, and the budget a small window would hand down:
    // 3k of context is all that may remain. The fixed rule would keep ~11k.
    const messages = ccWindowOf(12, 4_000)
    const budget = { preferredTokens: 2_000, ceilingTokens: 3_000 }

    const budgeted = runVccCompaction({
      messages: messages as never,
      preCompactTokenCount: 12_000,
      retentionBudget: budget,
    })
    const unbudgeted = runVccCompaction({
      messages: messages as never,
      preCompactTokenCount: 12_000,
    })

    expect(resultTokens(budgeted)).toBeLessThanOrEqual(budget.ceilingTokens)
    expect(budgeted.keptUserTurns).toBeGreaterThan(0)
    // The budget is what changed the outcome, not the fixture being small.
    expect(resultTokens(unbudgeted)).toBeGreaterThan(budget.ceilingTokens)
  })
})
