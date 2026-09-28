/**
 * Real-time decode-speed (TPS) meter.
 *
 * Reports output tokens/second for a session's live stream, from whichever
 * signal the backend actually provides:
 *
 *  1. `ids`  — the sidecar relayed the engine's real per-chunk token ids
 *              (`tps_tokens`). Those counts are exact, so they are summed
 *              as-is and every other signal is ignored for that window.
 *  2. `char` — no ids, so the streamed text itself is the measurement: CJK
 *              characters and full-width punctuation weigh one unit each,
 *              other non-whitespace characters a third of a unit, and each
 *              unit's tokens-per-unit is learned per model from the real
 *              `usage.output_tokens` every completed call reports.
 *
 * ## Why the text, and not the number of streamed frames
 *
 * An earlier version counted frames ("each chunk = one unit") and learned an
 * average tokens-per-frame. That is unsound for any engine that batches
 * unevenly, and this one does: measured on the local vLLM+DFlash engine, a
 * frame carrying streamed *text* holds ~2.5 tokens, a frame carrying
 * *thinking* ~12, and a frame carrying a tool-input JSON blob ~90-220. The
 * client also coalesces deltas before the meter sees them, so the observable
 * frame count is partly a property of the client's throttling.
 *
 * One global tokens-per-frame cannot serve densities that differ ~40x, and it
 * fails loudly rather than quietly: a single call whose frames were dense JSON
 * taught the local meter ~51 tokens/frame (clamped to the ceiling of 8), after
 * which six concurrent subagents writing prose — sparse frames, ~2.5 tokens
 * each — were billed at the JSON density and the indicator read ~800 tok/s
 * while the engine log showed ~250. The text length has no such failure mode:
 * it is a direct measure of what was decoded, whatever the batch size, so the
 * frame count is now used only for liveness and for the window's time span.
 *
 * Two coefficients rather than one, because the two character classes really
 * do tokenize at different rates: measured on the same engine, CJK prose is
 * ~1.0 token/char-unit while JSON/code is ~1.9 (short tokens, dense
 * punctuation). Both are learned together (least squares over every completed
 * call's units and its real token count) and stored per model, so mixed
 * Chinese-plus-code traffic stays inside a few tens of percent instead of the
 * factor-of-two a single coefficient would carry between a prose call and a
 * tool-input call.
 *
 * Window smoothing adapts to any emission granularity. Session lifecycle:
 *  - hasStreamed() is true once any content arrived; the UI stays visible.
 *  - While decoding, value() returns the live window speed.
 *  - When decoding pauses / a turn ends, value() falls back to the held speed —
 *    anchored to the real `output_tokens / decode span` when endCall() saw one,
 *    so the number the user keeps seeing is a real-token rate.
 */

const WINDOW_MS = 1500
// Held value = average speed over the 0.5s immediately before the stream's last
// emitted chunk, i.e. the speed at which the turn ended.
const FALLBACK_WINDOW_MS = 500
// Denominator floor for the live-window speed (ms). Mobile ws/event loops can
// batch many deltas so the intra-window span collapses to near-zero and
// total/span would read in the hundreds/thousands. A small floor (NOT the full
// 1.5s window) keeps that burst suppression while letting a turn's *opening*
// read the real speed quickly — the old 1.5s floor spread a fresh turn's first
// seconds across the whole window and systematically under-read the start. The
// UI's 30/70 exponential smoothing then damps any residual spike.
const BURST_FLOOR_MS = 400
// How long a batch must have been in the window before it is rated. The relay
// flushes on a ~200 ms timer, so the batch at the leading edge is a partial one
// whose count AND interval both understate; on a phase switch it is instead the
// whole backlog of a stall, which is the other way to be wrong. Rating the
// window only up to a settled point drops both cases. The cost is that the
// readout lags this much, which is below what the eye resolves on a rate.
const SETTLE_MS = 230
// Upper bound on the tokens a sample can carry per second of the interval since
// the previous one. Nothing measured here comes close (the local engines run
// around 250, the fastest configurations under 1000), so a sample above this is
// not a decode reading at all: it is a batch whose tokens were generated before
// they were delivered. Generous on purpose — it only has to separate "delivered
// as generated" from "delivered at once", and those differ by orders of magnitude.
const MAX_INSTANT_TPS = 5_000
const CJK_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/
const WHITESPACE_RE = /\s/
const NON_CJK_TOKEN_WEIGHT = 1 / 3.5
// A live-window speed below this many tokens/second is treated as a stream
// boundary (text ↔ thinking ↔ tool-input switch), not real slow decoding: the
// just-flushed window holds only a couple of sparse samples whose rate would
// otherwise collapse toward 0. We hold the smoothed fallback instead.
const SPARSE_SPEED_THRESHOLD = 5
// Tail skip when computing the held average. 0: the user wants the speed over
// the 0.5s slice *immediately before* the last chunk, including the final
// moments — so nothing is skipped.
const FALLBACK_SKIP_MS = 0

// ── Calibration ───────────────────────────────────────────────────────────
/**
 * Bounds for a learned tokens-per-unit coefficient. The band spans the
 * plausible tokenizer densities (a mixed corpus sits near 1.0, dense
 * code/JSON near 2) with room on either side, while still bounding the damage
 * a single weird call could do.
 */
const K_MIN = 0.25
const K_MAX = 6
/** A call below this many real output tokens is too small to teach anything. */
const MIN_REAL_TOKENS_TO_LEARN = 50
/** Nor may a call settle coefficients from only a handful of text units. */
const MIN_UNITS_TO_LEARN = 40
/** A call whose unit count dwarfs the running mean is a replay, not a real burst. */
const OUTLIER_UNIT_FACTOR = 3
const UNIT_MEAN_EWMA_ALPHA = 0.2
/**
 * Forgetting factor on the least-squares accumulators: the engine's density is
 * stable, but a session that switched models (and kept this meter) should not
 * be outvoted forever by its first calls.
 */
const LEARN_FORGET = 0.9
/** Below this relative determinant the two classes are not separable yet. */
const SINGULAR_EPS = 1e-6

/**
 * Master switch for the TPS indicator. Set to false to disable the meter
 * (no sampling in the content_delta path and no UI) while keeping the code in
 * place — used to isolate whether the indicator interacts with tool calls.
 */
const TPS_ENABLED = true

export function isTpsEnabled(): boolean {
  return TPS_ENABLED
}

export type TpsSource = 'ids' | 'char'

/** Learned tokens-per-unit, per character class (see the module docs). */
export type TpsCalibration = { kCjk: number; kAscii: number }

/** Text units split by class, the meter's raw measurement. */
type Sample = {
  t: number
  /** CJK / full-width characters, 1 unit each. */
  cjk: number
  /** Other non-whitespace characters, 1/3.5 unit each. */
  ascii: number
  /** Relayed exact token count (0 for text samples). */
  ids: number
  /**
   * Which concurrently-decoding stream this sample came from. Undefined for the
   * session's own output, which is the only stream in the single-stream case.
   *
   * Several streams (the main turn plus every running subagent) interleave into
   * one sample list, so "the gap since the previous sample" is not the interval
   * this sample's tokens were produced over unless the previous sample came from
   * the same stream. See sliceRate().
   */
  stream?: string
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function textUnits(text: string): { cjk: number; ascii: number } {
  let cjk = 0
  let ascii = 0
  for (const ch of text) {
    if (WHITESPACE_RE.test(ch)) continue
    if (CJK_RE.test(ch)) cjk += 1
    else ascii += 1
  }
  return { cjk, ascii: ascii * NON_CJK_TOKEN_WEIGHT }
}

export class TpsMeter {
  private samples: Sample[] = []
  private lastPushAt = 0
  private fallbackTps = 0
  private everStreamed = false
  private readonly windowMs: number
  private readonly fallbackWindowMs: number

  // Learned coefficients and the least-squares accumulators behind them. They
  // describe the model, not this window, so reset() keeps them.
  /**
   * Arrival time of the sample just before the window's first one. A window's
   * in-span says how fast samples arrived, not how long the tokens inside them
   * took to generate, and the two stop agreeing across a pause: at a phase
   * switch the engine stalls, the relay keeps batching, and the backlog flushes
   * as one fat sample. Anchoring to this instead of to the burst floor is what
   * keeps that backlog from reading as a burst — see value().
   */
  private preWindowAt = 0
  private kCjk = 1
  private kAscii = 1
  private sCC = 0
  private sAA = 0
  private sCA = 0
  private sCY = 0
  private sAY = 0
  private unitMean: number | null = null

  // Units observed since beginCall(); reconciled against real tokens in endCall().
  private callOpen = false
  private callCjk = 0
  private callAscii = 0
  private callIds = 0
  private callFirstAt = 0
  private callLastAt = 0

  constructor(windowMs = WINDOW_MS, fallbackWindowMs = FALLBACK_WINDOW_MS) {
    this.windowMs = windowMs
    this.fallbackWindowMs = fallbackWindowMs
  }

  /**
   * Feed a streamed text chunk.
   *
   * `wholeBlock` marks a delivery that carries a finished block rather than a
   * fragment (a replayed `thinking` block, a non-streamed answer). It is
   * accepted for call-site compatibility but changes nothing: the measurement
   * is the text itself, which a whole block carries just as well as a
   * fragment does.
   */
  push(
    text: string,
    options: { wholeBlock?: boolean; external?: boolean; stream?: string } = {},
  ): void {
    const now = performance.now()
    this.lastPushAt = now
    this.everStreamed = true
    const external = options.external === true
    const { cjk, ascii } = text ? textUnits(text) : { cjk: 0, ascii: 0 }
    if (cjk === 0 && ascii === 0) {
      if (!external) this.noteCallFrame(now)
      return
    }
    this.samples.push({
      t: now,
      cjk,
      ascii,
      ids: 0,
      ...(options.stream ? { stream: options.stream } : {}),
    })
    if (!external) this.noteCallFrame(now, cjk, ascii)
    // A slice with no timable span reports 0 — that means "no measurement",
    // not "the rate is zero", so the held speed keeps its last real value.
    const held = this.computeFallbackTps(now)
    if (held > 0) this.fallbackTps = held
  }

  /**
   * Feed a real token count relayed by the sidecar (the engine's per-chunk
   * `token_ids`). These are exact, so they bypass calibration entirely.
   */
  pushTokens(tokens: number, stream?: string): void {
    const count = Math.floor(tokens)
    if (!Number.isFinite(count) || count <= 0) return
    const now = performance.now()
    this.samples.push({
      t: now,
      cjk: 0,
      ascii: 0,
      ids: count,
      ...(stream ? { stream } : {}),
    })
    this.lastPushAt = now
    this.everStreamed = true
    this.noteCallFrame(now, 0, 0, count)
    // A slice with no timable span reports 0 — that means "no measurement",
    // not "the rate is zero", so the held speed keeps its last real value.
    const held = this.computeFallbackTps(now)
    if (held > 0) this.fallbackTps = held
  }

  /** Bump liveness without recording units (a frame the exact source already covers). */
  touch(): void {
    this.lastPushAt = performance.now()
    this.everStreamed = true
  }

  /** True once this session has ever received streamed content. */
  hasStreamed(): boolean {
    return this.everStreamed
  }

  /**
   * True while the sliding window still holds fresh samples — i.e. this
   * stream is actively emitting right now. Once the window drains, a
   * finished session's held turn-ending speed must not keep feeding the
   * aggregate (see aggregateMeterReadings).
   */
  hasLiveSamples(): boolean {
    this.prune()
    return this.samples.length > 0
  }

  /** Epoch ms of the most recent streamed chunk (0 if never). */
  lastDataTime(): number {
    return this.lastPushAt
  }

  /** Which signal the current window is reading (for UI/diagnostics). */
  source(): TpsSource {
    this.prune()
    for (const sample of this.samples) {
      if (sample.ids > 0) return 'ids'
    }
    return 'char'
  }

  /** Learned coefficients, for persistence per model (see tpsCalibration). */
  calibration(): TpsCalibration {
    return { kCjk: this.kCjk, kAscii: this.kAscii }
  }

  /**
   * Seed coefficients learned from earlier sessions with the same model.
   *
   * `undefined` leaves the current coefficients alone; `null` means "this model
   * has nothing remembered" and resets to the neutral 1.0 (so a model switch
   * re-learns instead of inheriting the previous model's numbers).
   */
  setCalibration(calibration: TpsCalibration | null | undefined): void {
    if (calibration === undefined) return
    if (calibration === null) {
      this.kCjk = 1
      this.kAscii = 1
      this.sCC = 0
      this.sAA = 0
      this.sCA = 0
      this.sCY = 0
      this.sAY = 0
      this.unitMean = null
      return
    }
    const { kCjk, kAscii } = calibration
    if (Number.isFinite(kCjk) && kCjk > 0) this.kCjk = clamp(kCjk, K_MIN, K_MAX)
    if (Number.isFinite(kAscii) && kAscii > 0) this.kAscii = clamp(kAscii, K_MIN, K_MAX)
  }

  /** Open a reconciliation window for one API call. */
  beginCall(): void {
    this.callOpen = true
    this.callCjk = 0
    this.callAscii = 0
    this.callIds = 0
    this.callFirstAt = 0
    this.callLastAt = 0
  }

  /** Open a call window unless one is already open (idempotent per frame). */
  ensureCall(): void {
    if (!this.callOpen) this.beginCall()
  }

  /**
   * Close the call opened by beginCall() and reconcile the measured text with
   * the real output token count the CLI reported.
   *
   * Always anchors the held speed to the real rate when a decode span can be
   * measured; learns the coefficients only when the call carried no exact ids
   * (those need no calibration) and the sample is big enough to trust.
   *
   * @param decodeSpanMs real decode span when the CLI reported one, else the
   *        caller's observed span (first→last frame of the call).
   * @returns whether a coefficient was actually updated (so callers know
   *          whether there is anything new worth persisting).
   */
  endCall(realTokens: number, decodeSpanMs?: number): boolean {
    const callCjk = this.callCjk
    const callAscii = this.callAscii
    const callIds = this.callIds
    const firstAt = this.callFirstAt
    const lastAt = this.callLastAt
    this.callOpen = false
    this.callCjk = 0
    this.callAscii = 0
    this.callIds = 0
    this.callFirstAt = 0
    this.callLastAt = 0

    const real = Math.floor(realTokens)
    if (!Number.isFinite(real) || real <= 0) return false

    const spanMs = decodeSpanMs && decodeSpanMs > 0
      ? decodeSpanMs
      : (firstAt > 0 && lastAt > firstAt ? lastAt - firstAt : 0)
    if (spanMs > 0) this.fallbackTps = real / (spanMs / 1000)

    if (callIds > 0) return false
    const units = callCjk + callAscii
    if (units < MIN_UNITS_TO_LEARN) return false
    // A fallback/retry replays the prefix, inflating units without inflating
    // real tokens. Drop the sample instead of teaching the coefficients a lie.
    if (this.unitMean !== null && units > OUTLIER_UNIT_FACTOR * this.unitMean) return false
    if (real < MIN_REAL_TOKENS_TO_LEARN) return false
    this.unitMean = this.unitMean === null
      ? units
      : this.unitMean + UNIT_MEAN_EWMA_ALPHA * (units - this.unitMean)

    return this.learn(callCjk, callAscii, real)
  }

  /**
   * Fold one call's (class units, real tokens) into the two coefficients by
   * least squares, so the estimator sums to the real count for the calls seen
   * so far rather than to whichever single call came last.
   *
   * Two unknowns need more than one equation: the accumulators keep the normal
   * equations of every past call, which is what lets a prose-heavy call and a
   * JSON-heavy call separate the classes. Until both classes have actually
   * appeared the system is singular, and the class that did appear is fitted on
   * its own.
   */
  private learn(cjk: number, ascii: number, real: number): boolean {
    const f = LEARN_FORGET
    this.sCC = f * this.sCC + cjk * cjk
    this.sAA = f * this.sAA + ascii * ascii
    this.sCA = f * this.sCA + cjk * ascii
    this.sCY = f * this.sCY + cjk * real
    this.sAY = f * this.sAY + ascii * real

    const det = this.sCC * this.sAA - this.sCA * this.sCA
    const scale = this.sCC * this.sAA
    if (scale > 0 && det > SINGULAR_EPS * scale) {
      const kCjk = (this.sCY * this.sAA - this.sAY * this.sCA) / det
      const kAscii = (this.sAY * this.sCC - this.sCY * this.sCA) / det
      let learned = false
      if (kCjk > 0) { this.kCjk = clamp(kCjk, K_MIN, K_MAX); learned = true }
      if (kAscii > 0) { this.kAscii = clamp(kAscii, K_MIN, K_MAX); learned = true }
      return learned
    }
    // Not separable yet — only one class has appeared, or every call so far
    // mixed them in the same proportion. Fit the single coefficient the data
    // does support (kCjk = kAscii = k, whose least-squares solution is the sum
    // over both classes) so the estimator is not stuck at the neutral 1.0
    // until the mixes happen to diverge.
    const denom = this.sCC + this.sAA + 2 * this.sCA
    if (denom <= 0) return false
    const k = (this.sCY + this.sAY) / denom
    if (!(k > 0)) return false
    const settled = clamp(k, K_MIN, K_MAX)
    // Only classes that actually appeared may be written: a call of pure
    // latin tool-input says nothing about what a CJK character costs, and
    // letting it set that coefficient would bill the next Chinese reply at
    // code density until some later call happened to correct it.
    let learned = false
    if (this.sCC > 0) { this.kCjk = settled; learned = true }
    if (this.sAA > 0) { this.kAscii = settled; learned = true }
    return learned
  }

  /**
   * Tokens/second within the sliding window. While decoding steadily this is
   * the live window speed; when the engine pauses or switches streams
   * (text → thinking → tool input) the just-flushed window can hold only a
   * couple of sparse samples whose instantaneous rate would collapse toward 0.
   * In that case fall back to the held speed so the indicator holds a sensible
   * value instead of flashing 0 between turns.
   */
  value(): number {
    this.prune()
    if (this.samples.length === 0) return this.fallbackTps
    // Rate the settled part of the window, not its leading edge: the newest
    // batch is a partial flush — or, at a phase switch, the whole backlog of a
    // stall — so its count and its interval are the two ways to be wrong at
    // once. Nothing is settled yet right after a reset, where the held speed is
    // the honest answer anyway.
    const settledEnd = performance.now() - SETTLE_MS
    let lastIndex = this.samples.length - 1
    while (lastIndex >= 0 && this.samples[lastIndex]!.t > settledEnd) lastIndex--
    const rate = lastIndex < 0
      ? null
      : this.sliceRate(0, lastIndex, this.preWindowAt)
    if (rate === null) return this.fallbackTps
    // Boundary guard: a slice whose live speed is below the sparse threshold is
    // a stream switch, not slow decoding — hold the smoothed fallback and do
    // NOT let the sparse rate overwrite it. The held value is owned exclusively
    // by push()/endCall(): refreshing it here would let the shrinking tail
    // window overwrite the requested turn-ending speed as the window drains.
    if (rate < SPARSE_SPEED_THRESHOLD) return this.fallbackTps
    return rate
  }

  /**
   * Tokens per second over `samples[fromIndex..lastIndex]`, or `null` when that
   * slice cannot be timed at all.
   *
   * A batch's tokens are produced between it and the batch before it, so the
   * denominator starts at the batch *preceding* the slice — `originT`, the one
   * sample just outside it (`prune()` keeps exactly that one as
   * `preWindowAt`). Anchoring there is not merely safer, it is the correct
   * arithmetic: k equal batches then cover k intervals, so steady decoding
   * reads its true rate instead of over-reading by one batch.
   *
   * It is also what keeps a phase switch from reading as a burst. When the
   * engine stalls (think → tool, tool → content) the relay keeps batching and
   * the next flush carries the whole backlog; dividing that backlog by the
   * window's own span — or, worse, by the burst floor — turns the stall into a
   * spike, which is what the readout showed at exactly these boundaries.
   *
   * With no preceding batch the oldest sample in the slice has no interval of
   * its own, so it is dropped rather than charged to the remaining span: that
   * is how a whole thinking block delivered in one sample read as 22500 t/s.
   * A slice with nothing timable returns `null`, and the caller holds.
   */
  private sliceRate(fromIndex: number, lastIndex: number, originT: number): number | null {
    const samples = this.samples
    let start = fromIndex
    let origin = originT
    if (!(origin > 0 && origin < samples[start]!.t)) {
      origin = samples[start]!.t
      start += 1
    }
    if (start > lastIndex) return null
    // Rate only the samples that could have been generated at the pace their
    // arrival implies. A sample that arrives carrying more tokens than any real
    // decode could have produced in the gap since the previous one is part of a
    // BATCH — a replayed prefix, a non-streamed fallback handed over whole, a
    // backlog the relay delivered at once while the page was busy (a Bash step's
    // output keeps the main thread occupied in exactly that way). Those tokens
    // were generated before they arrived, and nothing in this window records
    // when, so they are left out instead of being charged to an interval they
    // did not occupy: measured 7153 t/s for a replayed block and 3602 t/s for a
    // backlog flush, both against a real 250.
    //
    // The first sample of a delayed delivery keeps its large gap, so a backlog
    // is still rated honestly against the pause it was generated across.
    //
    // The gap has to be measured against the previous sample of the SAME stream.
    // The window holds several streams at once — the main turn and every running
    // subagent interleave into this one list — and a neighbouring sample usually
    // belongs to a different one, so the overall gap is a fraction of the
    // interval the tokens actually took. Measured against it, a normal 5-token
    // chunk landing 0.3 ms after another stream's chunk reads as 16 000 t/s and
    // is thrown away as a batch; with four subagents decoding that discarded
    // ~70% of the window and pinned the readout at ~75 t/s while the engine was
    // truly doing 250. Per-stream, the same data rates 245.
    //
    // A stream whose previous sample lies before the slice falls back to
    // `origin`, which is the conservative choice: it keeps the sample rather
    // than discarding it for lack of a reference.
    let total = 0
    let lastKeptT = 0
    let kept = 0
    const previousByStream = new Map<string, number>()
    for (let i = start; i <= lastIndex; i++) {
      const sample = samples[i]!
      const key = sample.stream ?? ''
      const previousT = previousByStream.get(key) ?? origin
      const gapMs = sample.t - previousT
      const tokens = this.sampleTokens(sample)
      if (gapMs > 0 && tokens / (gapMs / 1000) <= MAX_INSTANT_TPS) {
        total += tokens
        lastKeptT = sample.t
        kept += 1
      }
      previousByStream.set(key, sample.t)
    }
    if (kept === 0) return null
    const span = (lastKeptT - origin) / 1000
    // Below the floor there is no span worth dividing by, and inventing one
    // (the old behavior: divide by 400 ms regardless) is what produced the
    // thousands-per-second readings this is meant to prevent.
    if (span < BURST_FLOOR_MS / 1000) return null
    return total / span
  }

  reset(): void {
    this.samples = []
    // A source switch mid-stream resets the window to avoid mixing units, but
    // the tokens either side of it split one continuous generation, so the
    // anchor survives: without it the first flush after the switch lands alone
    // in an empty window and is divided by the burst floor instead of by the
    // time it actually took. Reset also fires on reconnect and retry, where the
    // gap is real generation time too, so there is nothing to distinguish.
    this.preWindowAt = this.lastPushAt
    this.everStreamed = false
    this.lastPushAt = 0
    this.fallbackTps = 0
    this.callOpen = false
    this.callCjk = 0
    this.callAscii = 0
    this.callIds = 0
    this.callFirstAt = 0
    this.callLastAt = 0
  }

  /** Calibrated token total held in the window (diagnostics/tests). */
  windowTokens(): number {
    this.prune()
    let ids = 0
    let cjk = 0
    let ascii = 0
    for (const sample of this.samples) {
      ids += sample.ids
      cjk += sample.cjk
      ascii += sample.ascii
    }
    // The relay reports every call on this session's socket, subagents
    // included (they share the session id), so an ids window is complete and
    // must not have a text estimate added on top of it.
    if (ids > 0) return ids
    return cjk * this.kCjk + ascii * this.kAscii
  }

  private noteCallFrame(now: number, cjk = 0, ascii = 0, ids = 0): void {
    if (!this.callOpen) return
    if (this.callFirstAt === 0) this.callFirstAt = now
    this.callLastAt = now
    this.callCjk += cjk
    this.callAscii += ascii
    this.callIds += ids
  }

  private computeFallbackTps(now: number): number {
    // Average token rate over the last fallbackWindowMs (0.5s) of streamed
    // data — the speed at which the turn ended. FALLBACK_SKIP_MS trims the
    // newest slice (0 by default). Rated by the same rule as the live window,
    // so a slice whose tokens arrived in one flush cannot be divided by the
    // slice length: that path held a whole block's tokens against 0.5 s and
    // pinned the readout at its ceiling for as long as the value was held.
    const windowEnd = now - FALLBACK_SKIP_MS
    const windowStart = windowEnd - this.fallbackWindowMs
    let startIndex = -1
    let lastIndex = -1
    let originT = 0
    for (let i = this.samples.length - 1; i >= 0; i--) {
      const s = this.samples[i]!
      if (s.t < windowStart) {
        // The batch just outside the slice times the first one inside it.
        originT = s.t
        break
      }
      if (s.t > windowEnd) continue
      // Walking back to front, so the first hit is the newest in the slice and
      // the last is the oldest: only the former may be assigned once.
      if (lastIndex < 0) lastIndex = i
      startIndex = i
    }
    if (startIndex < 0) return 0
    return this.sliceRate(startIndex, lastIndex, originT) ?? 0
  }

  private sampleTokens(sample: Sample): number {
    if (sample.ids > 0) return sample.ids
    return sample.cjk * this.kCjk + sample.ascii * this.kAscii
  }

  private prune(): void {
    const cutoff = performance.now() - this.windowMs
    while (this.samples.length > 0 && this.samples[0]!.t < cutoff) {
      // Keep the last one to fall out: it is the anchor a sparse window is
      // extended back to.
      this.preWindowAt = this.samples.shift()!.t
    }
  }
}

/**
 * Aggregate reading for a session's TPS indicator. `tps` is the team-wide
 * decode speed; `activeSubs` is the count of subagents currently emitting.
 */
export type TpsAggregate = {
  visible: boolean
  tps: number
  /** Subagent meters with fresh samples in the window (emitting right now). */
  activeSubs: number
}

/**
 * Build the session's reading from its own meter, using the subordinate
 * (subagent/team-member) meters only to count who is emitting right now.
 *
 *  - `own` already carries every subagent's relayed decode text (chatStore
 *    folds it in per frame, see ingestSubagentTps), so the summed value is
 *    just `own.value()`. The subordinate meters must NOT be added on top: they
 *    hold the same tokens and would double the reported rate.
 *  - While nothing is decoding the reading falls back to the own session's
 *    held speed — identical to the pre-aggregation single-session behavior,
 *    so a lone main session is unaffected.
 *  - Visibility / the 5-min idle hide rule considers the newest data from
 *    the whole group, so a busy subagent keeps the main indicator alive.
 */
export function aggregateMeterReadings(
  own: TpsMeter,
  subordinates: TpsMeter[],
  now: number,
  hideAfterIdleMs: number,
): TpsAggregate {
  const everStreamed = own.hasStreamed() || subordinates.some((m) => m.hasStreamed())
  if (!everStreamed) return { visible: false, tps: 0, activeSubs: 0 }

  let lastData = own.lastDataTime()
  for (const m of subordinates) {
    if (m.lastDataTime() > lastData) lastData = m.lastDataTime()
  }
  if (lastData > 0 && now - lastData > hideAfterIdleMs) {
    return { visible: false, tps: 0, activeSubs: 0 }
  }

  if (!own.hasStreamed()) {
    // Only a subordinate ever streamed: nothing is folded into the displayed
    // meter, so there is no honest rate to show yet.
    return { visible: false, tps: 0, activeSubs: 0 }
  }
  const activeSubs = subordinates.filter((m) => m.hasLiveSamples()).length
  return { visible: true, tps: own.value(), activeSubs }
}

/**
 * Coefficients {@link estimateTokens} should use, when a model's have been
 * learned. `null` means the neutral default (one token per CJK character, one
 * per 3.5 others).
 *
 * Module-level because the callers are pure functions invoked from render (the
 * thought badge, the activity digest) and a client is looking at one model at a
 * time; the alternative is threading a model id through every one of them. A
 * client showing two models at once would need this per session.
 */
let estimationCalibration: TpsCalibration | null = null

/**
 * Point the content-based estimates at a model's learned tokenizer density.
 *
 * The badge and the digest can only measure characters, so their number is a
 * guess until the meter has reconciled text against the real `output_tokens` a
 * call reported. Those learned coefficients are what makes the guess track the
 * real count (the meter learns them against real usage); using the neutral
 * default while the calibration sits unread in storage is what left the
 * estimate further off than it needed to be.
 */
export function setEstimationCalibration(calibration: TpsCalibration | null | undefined): void {
  estimationCalibration = calibration
    && Number.isFinite(calibration.kCjk) && calibration.kCjk > 0
    && Number.isFinite(calibration.kAscii) && calibration.kAscii > 0
    ? {
        kCjk: clamp(calibration.kCjk, K_MIN, K_MAX),
        kAscii: clamp(calibration.kAscii, K_MIN, K_MAX),
      }
    : null
}

export function estimateTokens(text: string): number {
  const { cjk, ascii } = textUnits(text)
  // Same shape the meter uses (see `value()`), so a learned calibration means
  // the same thing in both places. With no calibration the multipliers are 1,
  // which is exactly the neutral default this used to return.
  const kCjk = estimationCalibration?.kCjk ?? 1
  const kAscii = estimationCalibration?.kAscii ?? 1
  return cjk * kCjk + ascii * kAscii
}
