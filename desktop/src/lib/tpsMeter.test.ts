import { describe, expect, it, vi, afterEach } from 'vitest'
import { TpsMeter, estimateTokens } from './tpsMeter'

describe('TpsMeter fallback', () => {
  afterEach(() => vi.restoreAllMocks())

  it('holds the turn-ending speed after the stream pauses', () => {
    let now = 1_000_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const meter = new TpsMeter(1500, 2000)
    expect(meter.hasStreamed()).toBe(false)
    expect(meter.value()).toBe(0)

    // Stream ~60 tokens over ~1 second.
    for (let i = 0; i < 10; i++) {
      now += 100
      meter.push('x'.repeat(6))
    }
    expect(estimateTokens('x'.repeat(6))).toBeGreaterThan(0)
    expect(meter.hasStreamed()).toBe(true)

    const live = meter.value()
    expect(live).toBeGreaterThan(0)

    // Simulate turn end: no more pushes, window drains (advance 10s).
    now += 10_000
    const held = meter.value()
    // Fallback should still be > 0 (not dropped to 0).
    expect(held).toBeGreaterThan(0)
  })

  it('does not collapse to 0 on a sparse boundary sample', () => {
    let now = 1_000_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const meter = new TpsMeter(1500, 2000)
    // Steady stream first so the fallback has a meaningful speed.
    for (let i = 0; i < 20; i++) {
      now += 50
      meter.push('x'.repeat(6))
    }
    const baseline = meter.value()
    expect(baseline).toBeGreaterThan(0)

    // Stream boundary: a single tiny fragment lands (e.g. tool-input start),
    // then the window prunes the old bulk samples.
    now += 1600 // evict previous samples from the 1500ms window
    meter.push('{')
    // Only one ~1-token sample in the window now.
    const boundary = meter.value()
    // Must NOT read ~0: hold the smoothed fallback instead.
    expect(boundary).toBeGreaterThan(0.5)
  })

  it('skips the last 0.35s when computing the fallback average', () => {
    let now = 1_000_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const meter = new TpsMeter(1500, 2000)
    // Steady decode: 6 chars (≈1.7 tokens) every 100ms over 2s.
    for (let i = 0; i < 20; i++) {
      now += 100
      meter.push('x'.repeat(6))
    }
    const steady = meter.value()
    expect(steady).toBeGreaterThan(0)

    // Simulate a stream-switch burn: a long silent gap (0.6s) with no samples.
    now += 600
    // value() with an empty live window must fall back to a non-zero average
    // rather than 0 — the switch overhead is absorbed by the skip window.
    const heldAfterGap = meter.value()
    expect(heldAfterGap).toBeGreaterThan(0)
  })

  it('estimates tokens: CJK 1:1, full-width punctuation counted, ASCII 1:3.5, whitespace free', () => {
    // 4 CJK chars + 1 full-width comma → 5 tokens.
    expect(estimateTokens('你好世界，')).toBeCloseTo(5, 5)
    // 7 ASCII chars → 2 tokens (7 / 3.5).
    expect(estimateTokens('abcdefg')).toBeCloseTo(2, 5)
    // Whitespace and newlines carry no tokens of their own.
    expect(estimateTokens('a b\nc')).toBeCloseTo(3 / 3.5, 5)
    // Empty / whitespace-only input never over-counts.
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('   \n\t')).toBe(0)
  })
})
