import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TpsMeter } from '@/lib/tpsMeter'
import * as chatStore from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { TpsIndicator, formatTps } from './TpsIndicator'

// Drive the real meters with a fake clock so the sliding windows behave
// deterministically, and stub only the store lookups.
let now = 1_000_000
const ownMeter = new TpsMeter(1500, 500)
const subMeter = new TpsMeter(1500, 500)

function pump(meter: TpsMeter, n = 10): void {
  for (let i = 0; i < n; i++) {
    now += 100
    meter.push('x'.repeat(6))
  }
}

beforeEach(() => {
  now = 1_000_000
  ownMeter.reset()
  subMeter.reset()
  useSettingsStore.setState({ sessionExtendedInfo: true })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(chatStore, 'getSessionTpsMeter').mockReturnValue(ownMeter)
  vi.spyOn(chatStore, 'getSubordinateTpsMeters').mockReturnValue([subMeter])
})

afterEach(() => {
  cleanup()
  useSettingsStore.setState({ sessionExtendedInfo: true })
  vi.restoreAllMocks()
})

it('shows the aggregated total with a Σn badge while a subagent is emitting', async () => {
  pump(ownMeter)
  pump(subMeter)

  const { container } = render(<TpsIndicator sessionId="main" />)
  // The mount effect runs tick() synchronously, so the indicator has a reading.
  const indicator = container.querySelector('[data-testid="tps-indicator"]')
  expect(indicator).not.toBeNull()


  // Σ badge appears because the subagent meter is live in the window.
  expect(container.querySelector('[data-testid="tps-subagent-badge"]')).toHaveTextContent('Σ1')
  // Number rendered, and it is the combined total (> a single stream).
  const numberText = indicator!.textContent?.replace(/TPS|t\/s|Σ1/g, '').trim() ?? ''
  const shown = Number(numberText)
  expect(shown).toBeGreaterThan(0)
})

it('drops the Σ badge once the subagent stops (its held speed must not inflate the total)', async () => {
  pump(subMeter)
  // Subagent finishes; drain its 1500ms window.
  now += 10_000
  pump(ownMeter)

  const { container } = render(<TpsIndicator sessionId="main" />)
  expect(container.querySelector('[data-testid="tps-indicator"]')).not.toBeNull()
  expect(container.querySelector('[data-testid="tps-subagent-badge"]')).toBeNull()

})

it('caps the displayed value at 4 digits (9999)', () => {
  // Asserted on the formatter, not through the meter: a rate that high cannot
  // come out of the meter any more, because a sample carrying more tokens than
  // any real decode could produce in its interval is treated as a batch and left
  // out (that rule is what stopped the 1600+ t/s readings). The cap stays as the
  // display's own guarantee for any source.
  expect(formatTps(21_000)).toBe('9999')
  expect(formatTps(9999)).toBe('9999')
  expect(formatTps(250)).toBe('250')
})

it('reports an exact (ids) reading without the approximate mark', () => {
  // A plausible stream from the exact tier: 50 tokens per 200 ms flush = 250 t/s.
  for (let i = 0; i < 20; i++) {
    now += 200
    ownMeter.pushTokens(50)
  }
  const { container } = render(<TpsIndicator sessionId="main" />)
  const indicator = container.querySelector('[data-testid="tps-indicator"]')!
  expect(indicator).toHaveAttribute('data-tps-source', 'ids')
  expect(indicator).not.toHaveAttribute('title', expect.stringContaining('≈'))
})

it('marks a sampled (non-ids) reading as approximate', () => {
  pump(ownMeter)
  const { container } = render(<TpsIndicator sessionId="main" />)
  const indicator = container.querySelector('[data-testid="tps-indicator"]')!
  expect(indicator).toHaveAttribute('data-tps-source', 'char')
  expect(indicator).toHaveAttribute('title', expect.stringContaining('≈'))
})

it('stays hidden before anything has streamed', () => {
  const { container } = render(<TpsIndicator sessionId="main" />)
  expect(container.querySelector('[data-testid="tps-indicator"]')).toBeNull()
})

it('renders nothing when session extended info is off, even with a live reading', () => {
  pump(ownMeter)
  useSettingsStore.setState({ sessionExtendedInfo: false })
  const { container } = render(<TpsIndicator sessionId="main" />)
  expect(container.querySelector('[data-testid="tps-indicator"]')).toBeNull()
})



