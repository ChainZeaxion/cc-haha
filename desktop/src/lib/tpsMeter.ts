/**
 * Real-time decode-speed (TPS) meter.
 *
 * Tracks output token throughput from the assistant's live text stream. The
 * frontend receives content_delta chunks (arbitrary sizes — the engine may
 * emit 1, 3, 5 or N tokens per chunk), so the meter accumulates characters
 * into a sliding window and derives characters/second, which is displayed as
 * an approximate token/s. Window smoothing adapts to any emission granularity.
 *
 * Session lifecycle:
 *  - hasStreamed() is true once any chunk arrived; the UI stays visible.
 *  - While decoding, value() returns the live window speed.
 *  - When decoding pauses / a turn ends, value() falls back to the average
 *    speed over the last FALLBACK_WINDOW_MS (2s) of streamed data, so the
 *    indicator keeps showing the turn-ending speed instead of dropping to 0
 *    (or disappearing) the moment the engine stops emitting.
 *
 * Char→token heuristic calibrated for the local vLLM engines (Qwen / DeepSeek
 * tokenizers): CJK chars and full-width punctuation ≈ 1 token each, ASCII ≈ 1
 * token per 3.5 chars. Whitespace is not counted — tokenizers fold it into
 * neighbouring tokens, so counting it inflates the estimate.
 */

const WINDOW_MS = 1500
const FALLBACK_WINDOW_MS = 2000
// Denominator floor for the live-window speed (ms). Mobile ws/event loops can
// batch many content_delta chunks so the intra-window span collapses to near-zero
// and total/span would read in the hundreds/thousands. A small floor (NOT the full
// 1.5s window) keeps that burst suppression while letting a turn's *opening* read
// the real speed quickly — the old 1.5s floor spread a fresh turn's first seconds
// across the whole window and systematically under-read the start. The UI's 30/70
// exponential smoothing then damps any residual spike from a genuine batch.
const BURST_FLOOR_MS = 400
const CJK_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/
const WHITESPACE_RE = /\s/
const NON_CJK_TOKEN_WEIGHT = 1 / 3.5
// A live-window speed below this many tokens/second is treated as a stream
// boundary (text ↔ thinking ↔ tool-input switch), not real slow decoding: the
// just-flushed window holds only a couple of sparse samples whose rate would
// otherwise collapse toward 0. We hold the smoothed fallback instead.
const SPARSE_SPEED_THRESHOLD = 5
// The most recent slice of a stream is where message-type switching burns time
// (buffering, block handoff). When computing the fallback average we skip the
// last 0.3s of samples so the average reflects steady decoding, not the
// switch overhead.
const FALLBACK_SKIP_MS = 300

/**
 * Master switch for the TPS indicator. Set to false to disable the meter
 * (no sampling in the content_delta path and no UI) while keeping the code in
 * place — used to isolate whether the indicator interacts with tool calls.
 */
const TPS_ENABLED = true

export function isTpsEnabled(): boolean {
  return TPS_ENABLED
}

export class TpsMeter {
  private samples: Array<{ t: number; chars: number }> = []
  private windowMs: number
  private fallbackWindowMs: number
  private everStreamed = false
  private lastPushAt = 0
  private fallbackTps = 0

  constructor(windowMs = WINDOW_MS, fallbackWindowMs = FALLBACK_WINDOW_MS) {
    this.windowMs = windowMs
    this.fallbackWindowMs = fallbackWindowMs
  }

  /** Feed a streamed text chunk. */
  push(text: string): void {
    if (!text) return
    const now = performance.now()
    this.samples.push({ t: now, chars: estimateTokens(text) })
    this.everStreamed = true
    this.lastPushAt = now
    this.fallbackTps = this.computeFallbackTps(now)
  }

  /** True once this session has ever received streamed text. */
  hasStreamed(): boolean {
    return this.everStreamed
  }

  /** Epoch ms of the most recent streamed chunk (0 if never). */
  lastDataTime(): number {
    return this.lastPushAt
  }

  /**
   * Tokens/second within the sliding window. While decoding steadily this is
   * the live window speed; when the engine pauses or switches streams
   * (text → thinking → tool input) the just-flushed window can hold only a
   * couple of sparse samples whose instantaneous rate would collapse toward 0.
   * In that case fall back to the average over the last FALLBACK_WINDOW_MS so
   * the indicator holds a sensible speed instead of flashing 0 between turns.
   */
  value(): number {
    this.prune()
    if (this.samples.length === 0) return this.fallbackTps
    const total = this.samples.reduce((sum, s) => sum + s.chars, 0)
    const first = this.samples[0]!
    const last = this.samples[this.samples.length - 1]!
    const span = (last.t - first.t) / 1000
    // Burst guard (opt23 §11.27): on mobile a batched ws delivery can collapse the
    // intra-window span to near-zero, so a small floor (BURST_FLOOR_MS) prevents
    // total/span from reading in the hundreds. Using the full window here instead
    // would also under-read a turn's opening — see BURST_FLOOR_MS.
    const elapsed = Math.max(span, BURST_FLOOR_MS / 1000)
    const result = total / elapsed
    // Boundary guard: a window whose live speed is below the sparse threshold
    // is a stream switch, not slow decoding — hold the smoothed fallback and
    // do NOT let the sparse rate overwrite it.
    if (result < SPARSE_SPEED_THRESHOLD) return this.fallbackTps
    // Keep the fallback fresh with the most recent live speed while decoding.
    if (result > 0) this.fallbackTps = result
    return result
  }

  /** Raw character count in the window (for diagnostics). */
  chars(): number {
    this.prune()
    return this.samples.reduce((sum, s) => sum + s.chars, 0)
  }

  reset(): void {
    this.samples = []
    this.everStreamed = false
    this.lastPushAt = 0
    this.fallbackTps = 0
  }

  private computeFallbackTps(now: number): number {
    // Average token rate over the last fallbackWindowMs of streamed data, but
    // skip the most recent FALLBACK_SKIP_MS — that slice is where a stream
    // switch (text ↔ thinking ↔ tool-input) burns time, so excluding it keeps
    // the average reflecting steady decode speed.
    const windowEnd = now - FALLBACK_SKIP_MS
    const windowStart = windowEnd - this.fallbackWindowMs
    let total = 0
    let firstT: number | null = null
    let lastT: number | null = null
    for (let i = this.samples.length - 1; i >= 0; i--) {
      const s = this.samples[i]!
      if (s.t < windowStart) break
      if (s.t > windowEnd) continue
      total += s.chars
      if (lastT === null) lastT = s.t
      firstT = s.t
    }
    if (firstT === null || lastT === null) return 0
    const span = (lastT - firstT) / 1000
    if (span < 0.05) return total / (this.fallbackWindowMs / 1000)
    return total / span
  }

  private prune(): void {
    const cutoff = performance.now() - this.windowMs
    while (this.samples.length > 0 && this.samples[0]!.t < cutoff) {
      this.samples.shift()
    }
  }
}

export function estimateTokens(text: string): number {
  let cjk = 0
  let nonCjk = 0
  for (const ch of text) {
    if (WHITESPACE_RE.test(ch)) continue
    if (CJK_RE.test(ch)) cjk += 1
    else nonCjk += 1
  }
  return cjk + nonCjk * NON_CJK_TOKEN_WEIGHT
}
