import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearTpsDensity,
  currentTpsDensity,
  loadTpsSamples,
  recordTpsSample,
  resetTpsDensityForTests,
  TPS_DENSITY_POOL_MAX,
  TPS_DENSITY_STORAGE_KEY,
} from './tpsDensityStore'
import { PRIOR_DENSITY } from '../../../src/shared/tokenDensity'

const MODEL = 'zxsv-ai'

beforeEach(() => {
  resetTpsDensityForTests()
  clearTpsDensity()
  localStorage.clear()
})

describe('tpsDensityStore', () => {
  it('returns the prior before the pool is mature', () => {
    for (let i = 0; i < 9; i++) {
      recordTpsSample(MODEL, { cjk: 100, latin: 0, digit: 0, sym: 0 }, 100)
    }
    expect(currentTpsDensity(MODEL)).toEqual(PRIOR_DENSITY)
  })

  it('learns once the pool reaches its maturity floor', () => {
    // 10 samples all saying "one Chinese character costs 1.4 tokens".
    for (let i = 0; i < 10; i++) {
      recordTpsSample(MODEL, { cjk: 100, latin: 0, digit: 0, sym: 0 }, 140)
    }
    const density = currentTpsDensity(MODEL)
    expect(density.cjk).toBeGreaterThan(1.2)
    expect(density.cjk).toBeLessThan(1.5)
  })

  it('keeps the pool at its cap, dropping the oldest', () => {
    for (let i = 0; i < TPS_DENSITY_POOL_MAX + 5; i++) {
      recordTpsSample(MODEL, { cjk: i, latin: 0, digit: 0, sym: 0 }, i + 1)
    }
    expect(loadTpsSamples(MODEL)).toHaveLength(TPS_DENSITY_POOL_MAX)
    // Oldest (cjk: 0) dropped, newest kept.
    expect(loadTpsSamples(MODEL).at(-1)?.counts.cjk).toBe(TPS_DENSITY_POOL_MAX + 4)
  })

  it('ignores samples with no real tokens', () => {
    recordTpsSample(MODEL, { cjk: 10, latin: 0, digit: 0, sym: 0 }, 0)
    expect(loadTpsSamples(MODEL)).toHaveLength(0)
  })

  it('keys pools per model', () => {
    recordTpsSample('a', { cjk: 1, latin: 0, digit: 0, sym: 0 }, 1)
    expect(loadTpsSamples('a')).toHaveLength(1)
    expect(loadTpsSamples('b')).toHaveLength(0)
  })

  it('discards a payload from another version rather than guessing', () => {
    localStorage.setItem(
      TPS_DENSITY_STORAGE_KEY,
      JSON.stringify({ version: 999, models: { [MODEL]: { samples: [{ counts: {}, tokens: 1 }] } } }),
    )
    resetTpsDensityForTests()
    expect(loadTpsSamples(MODEL)).toHaveLength(0)
    expect(currentTpsDensity(MODEL)).toEqual(PRIOR_DENSITY)
  })
})
