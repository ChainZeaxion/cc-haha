/**
 * Session-level token accounting for the context panel.
 *
 * The four buckets the CLI reports are disjoint: `input_tokens` never includes cached tokens, so
 * summing them counts each token exactly once. (Providers whose wire format folds cache hits into
 * the prompt total are adapted on the way in — see `src/server/proxy/transform/usage.ts`.)
 *
 * The headline number is *new* tokens (uncached input + output), not every cache hit replayed
 * across a long agent loop. Counting cache reads as spend made a 270k-window session look like
 * 40M "total tokens" — the same prompt billed once per tool round.
 */

export type SessionUsageLike = {
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadInputTokens: number
  totalCacheCreationInputTokens: number
  totalDecodeDuration?: number
  totalAPIDuration?: number
}

export type SessionUsageMetrics = {
  /**
   * Uncached input + output. Cache hits are not spend — they are the same prompt seen again —
   * so they stay out of this number.
   */
  totalTokens: number
  /** Prompt-side tokens only: the denominator a cache hit rate is meaningful against. */
  promptTokens: number
  cachedTokens: number
  /** `null` when the session has sent no prompt tokens yet. */
  cacheHitRate: number | null
  /**
   * Output tokens over API wall-clock. `null` when no API duration was reported.
   * Decode-only spans exclude TTFT and read as a peak the user never felt.
   */
  tokensPerSecond: number | null
}

function finite(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Derives the panel's headline numbers.
 *
 * `tokensPerSecond` divides output tokens by the time the API was actually running, including
 * prefill. A caller that only has a transcript (no API duration) gets `null` rather than a rate
 * computed against wall clock that includes `Bash`.
 */
export function deriveSessionUsageMetrics(usage: SessionUsageLike): SessionUsageMetrics {
  const input = finite(usage.totalInputTokens)
  const output = finite(usage.totalOutputTokens)
  const cacheRead = finite(usage.totalCacheReadInputTokens)
  const cacheWrite = finite(usage.totalCacheCreationInputTokens)
  const apiMs = finite(usage.totalAPIDuration)

  const promptTokens = input + cacheRead + cacheWrite
  return {
    totalTokens: input + output,
    promptTokens,
    cachedTokens: cacheRead,
    cacheHitRate: promptTokens > 0 ? cacheRead / promptTokens : null,
    tokensPerSecond: apiMs > 0 && output > 0 ? output / (apiMs / 1000) : null,
  }
}

/**
 * Formats a cache hit rate without ever rounding a partial hit up to a flat 100%.
 *
 * A session at 99.96% is *not* fully cached, and printing "100%" would tell the user something
 * false about both their bill and their prompt stability. Widening the precision is the honest
 * fix; only a rate that is exactly 1 renders as 100%.
 */
export function formatCacheHitRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '0%'
  if (rate >= 1) return '100%'
  const percent = rate * 100
  const oneDecimal = percent.toFixed(1)
  if (oneDecimal !== '100.0') return `${oneDecimal}%`
  const twoDecimals = percent.toFixed(2)
  // 99.995% and up still rounds to 100.00; floor it so the maximum shown below
  // a true hit is visibly below a true hit.
  return twoDecimals === '100.00' ? '99.99%' : `${twoDecimals}%`
}

/** `100`, `42`, `9.4` — one decimal only while the number is small enough to need it. */
export function formatTokensPerSecond(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return value >= 10 ? `${Math.round(value)}` : `${value.toFixed(1)}`
}

/**
 * Request-level (latest-turn) cache hit rate, from the newest assistant usage.
 *
 * Unlike the session-cumulative `cacheHitRate` (which dilutes the ratio across a long agent
 * loop as earlier prompts are replayed), this reads the *most recent* turn only: cache reads as a
 * fraction of that turn's total prompt (fresh input + cache write + cache read). A long-running
 * session therefore reads as the cache actually performs turn-over-turn (~99%), not ~0.5%.
 *
 * Returns `null` when the turn produced no prompt tokens (no honest answer).
 */
export function latestTurnCacheHitRate(usage: {
  input_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}): number | null {
  const input = finite(usage.input_tokens)
  const cacheRead = finite(usage.cache_read_input_tokens)
  const cacheWrite = finite(usage.cache_creation_input_tokens)
  const promptTokens = input + cacheRead + cacheWrite
  return promptTokens > 0 ? cacheRead / promptTokens : null
}

/** Fixed display-only FX rate for the USD/CNY dual cost readout (not a billing conversion). */
export const CNY_PER_USD = 7.2

/**
 * `¥8.86` / `¥0.0036` — mirrors the server's USD formatting rules (2dp above ¥0.5, else 4dp) so
 * the two currencies read at the same precision next to each other.
 */
export function formatCnyCost(usd: number): string {
  const cny = usd * CNY_PER_USD
  return `¥${cny > 0.5 ? (Math.round(cny * 100) / 100).toFixed(2) : cny.toFixed(4)}`
}

/** `1.2M`, `375K`, `812` — compact enough for a stat row, never a lie about magnitude. */
export function formatCompactTokens(value: number): string {

  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1_000) return `${Math.round(value)}`
  const thousands = value / 1_000
  const decimals = thousands >= 100 ? 0 : 1
  // Rounding can push a value just under the next unit up to a full thousand of the smaller one
  // (999_949 reads as "1000K"); promote it so the row never shows four digits of a smaller unit.
  if (Number(thousands.toFixed(decimals)) >= 1_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  return `${thousands.toFixed(decimals)}K`
}
