import { describe, expect, test } from 'bun:test'
import {
  classifyChars,
  densityForSamples,
  estimateTokens,
  learnDensity,
  PRIOR_DENSITY,
  type DensitySample,
} from './tokenDensity.js'

describe('classifyChars', () => {
  test('splits text into the four mutually exclusive classes', () => {
    const counts = classifyChars('你好abc123,!')
    expect(counts).toEqual({ cjk: 2, latin: 3, digit: 3, sym: 2 })
  })

  test('full-width punctuation counts as cjk and whitespace costs nothing', () => {
    expect(classifyChars('，。 ')).toEqual({ cjk: 2, latin: 0, digit: 0, sym: 0 })
    expect(classifyChars('\n\t  ')).toEqual({ cjk: 0, latin: 0, digit: 0, sym: 0 })
  })
})

describe('estimateTokens with the prior', () => {
  test('Chinese costs ~1 token per character', () => {
    expect(estimateTokens('你好世界')).toBeCloseTo(4 * PRIOR_DENSITY.cjk, 6)
  })

  test('Latin prose costs ~1/3.5 per character', () => {
    expect(estimateTokens('hello')).toBeCloseTo(5 * PRIOR_DENSITY.latin, 6)
  })
})

describe('learnDensity', () => {
  // Varied mixes so all four densities are identifiable (a constant ratio would
  // make the design matrix rank-1 and the fit meaningless).
  const TRUE = { cjk: 1.0, latin: 0.3, digit: 0.6, sym: 0.45 }
  const samples: DensitySample[] = [
    { counts: { cjk: 200, latin: 20, digit: 5, sym: 10 }, tokens: 0 },
    { counts: { cjk: 10, latin: 300, digit: 40, sym: 60 }, tokens: 0 },
    { counts: { cjk: 80, latin: 80, digit: 200, sym: 30 }, tokens: 0 },
    { counts: { cjk: 40, latin: 30, digit: 20, sym: 400 }, tokens: 0 },
    { counts: { cjk: 150, latin: 120, digit: 90, sym: 70 }, tokens: 0 },
    { counts: { cjk: 25, latin: 210, digit: 15, sym: 25 }, tokens: 0 },
    { counts: { cjk: 300, latin: 15, digit: 8, sym: 40 }, tokens: 0 },
    { counts: { cjk: 60, latin: 60, digit: 60, sym: 60 }, tokens: 0 },
    { counts: { cjk: 5, latin: 500, digit: 5, sym: 5 }, tokens: 0 },
    { counts: { cjk: 90, latin: 10, digit: 300, sym: 10 }, tokens: 0 },
    { counts: { cjk: 20, latin: 20, digit: 20, sym: 500 }, tokens: 0 },
    { counts: { cjk: 120, latin: 140, digit: 30, sym: 90 }, tokens: 0 },
  ].map((s) => ({
    counts: s.counts,
    tokens:
      s.counts.cjk * TRUE.cjk +
      s.counts.latin * TRUE.latin +
      s.counts.digit * TRUE.digit +
      s.counts.sym * TRUE.sym,
  }))

  test('recovers the true densities from clean samples', () => {
    const learned = learnDensity(samples)
    expect(learned.cjk).toBeCloseTo(TRUE.cjk, 1)
    expect(learned.latin).toBeCloseTo(TRUE.latin, 1)
    expect(learned.digit).toBeCloseTo(TRUE.digit, 1)
    expect(learned.sym).toBeCloseTo(TRUE.sym, 1)
  })

  test('a class with no samples stays at its prior (shrinkage, not garbage)', () => {
    const cjkOnly = samples.map((s) => ({ counts: { cjk: s.counts.cjk, latin: 0, digit: 0, sym: 0 }, tokens: s.counts.cjk }))
    const learned = learnDensity(cjkOnly)
    expect(learned.cjk).toBeCloseTo(1, 1)
    // No Latin data at all ⇒ the Latin density is governed by the prior.
    expect(learned.latin).toBeCloseTo(PRIOR_DENSITY.latin, 6)
  })

  test('ignores samples with no real tokens', () => {
    const withJunk: DensitySample[] = [...samples, { counts: { cjk: 0, latin: 0, digit: 0, sym: 9999 }, tokens: 0 }]
    const a = learnDensity(samples)
    const b = learnDensity(withJunk)
    expect(b).toEqual(a)
  })
})

describe('densityForSamples maturity gate', () => {
  const samples: DensitySample[] = Array.from({ length: 12 }, (_, i) => ({
    counts: { cjk: 100 + i, latin: 50, digit: 10, sym: 20 },
    tokens: 100 + i + 50 * 0.3 + 10 * 0.6 + 20 * 0.45,
  }))

  test('below the floor the prior is used as-is', () => {
    expect(densityForSamples(samples.slice(0, 9))).toEqual(PRIOR_DENSITY)
  })

  test('at the floor the learned fit takes over', () => {
    expect(densityForSamples(samples.slice(0, 10))).not.toEqual(PRIOR_DENSITY)
  })
})
