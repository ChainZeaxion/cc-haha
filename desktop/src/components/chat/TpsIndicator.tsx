import { useEffect, useState } from 'react'
import { getSessionTpsMeter } from '../../stores/chatStore'
import { isTpsEnabled } from '../../lib/tpsMeter'
import { useTranslation } from '../../i18n'

/**
 * Real-time decode-speed (TPS) indicator.
 *
 * Lifecycle:
 *  - Before this session has ever streamed (no input/decoded tokens yet) →
 *    hidden.
 *  - After the first streamed chunk it stays visible for the rest of the
 *    session. While decoding, value() is the live window speed and updates
 *    every poll; when decoding pauses it holds the last speed.
 *  - If no new data arrives for HIDE_AFTER_IDLE_MS (5 min) it hides again.
 *
 * Coloring: <27 red, <70 orange, >=70 green. Polled at POLL_MS (≈5-6 Hz).
 * Meter is per-session (see getSessionTpsMeter), so parallel sessions each
 * show their own decode speed.
 */

const POLL_MS = 180
const LOW_TIER = 27
const MED_TIER = 53
const HIGH_TIER = 80
const HIDE_AFTER_IDLE_MS = 5 * 60 * 1000

type TpsTier = 'red' | 'orange' | 'green' | 'purple'

function tierFor(tps: number): TpsTier {
  if (tps < LOW_TIER) return 'red'
  if (tps < MED_TIER) return 'orange'
  if (tps < HIGH_TIER) return 'green'
  return 'purple'
}

const TIER_STYLE: Record<TpsTier, { color: string; bg: string }> = {
  red: { color: 'var(--color-error)', bg: 'var(--color-error-container)' },
  orange: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  green: { color: 'var(--color-success)', bg: 'var(--color-success-container)' },
  purple: { color: '#a855f7', bg: 'rgba(168,85,247,0.16)' },
}

export function TpsIndicator({ sessionId, vertical = false }: { sessionId: string; vertical?: boolean }) {
  const t = useTranslation()
  const [tps, setTps] = useState(0)
  const [visible, setVisible] = useState(false)

  // Master switch: when disabled the indicator renders nothing and never polls
  // the meter (the meter itself is also not fed in the content_delta path).
  if (!isTpsEnabled()) return null

  useEffect(() => {
    const meter = getSessionTpsMeter(sessionId)
    const tick = () => {
      const streamed = meter.hasStreamed()
      if (!streamed) {
        setVisible(false)
        return
      }
      const lastData = meter.lastDataTime()
      const idleMs = lastData > 0 ? performance.now() - lastData : Number.POSITIVE_INFINITY
      if (idleMs > HIDE_AFTER_IDLE_MS) {
        setVisible(false)
        return
      }
      const value = meter.value()
      // A near-zero read at a stream boundary (text↔thinking↔tool) is not a
      // real decode speed — hold the previous reading instead of flashing 0.
      setTps((prev) => {
        if (value < 0.5) return prev > 0.5 ? prev : value
        // opt23 §11.27: 指数平滑（新值 30% + 上次 70%）抑制移动端突发导致
        // 的 TPS 忽高忽低；首次读取直接采用。
        return prev > 0.5 ? prev * 0.7 + value * 0.3 : value
      })
      setVisible(true)
    }
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [sessionId])

  if (!visible) return null
  const tier = tierFor(tps)
  const style = TIER_STYLE[tier]

  if (vertical) {
    return (
      <span
        data-testid="tps-indicator"
        className="inline-flex shrink-0 flex-col items-center justify-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold leading-none tabular-nums"
        style={{ color: style.color, background: style.bg }}
        title={t('chat.tpsSpeedTitle')}
      >
        <span className="font-bold leading-none">TPS</span>
        <span className="mt-0.5 inline-block text-center leading-none">
          {tps.toFixed(0)}
        </span>
      </span>
    )
  }

  return (
    <span
      data-testid="tps-indicator"
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
      style={{ color: style.color, background: style.bg }}
      title={t('chat.tpsSpeedTitle')}
    >
      <span className="inline-block min-w-[6ch] text-right">
        {tps.toFixed(0)}
      </span>
      <span>t/s</span>
    </span>
  )
}
