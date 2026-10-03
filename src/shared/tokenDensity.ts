/**
 * Character-class token density — how many tokens a tokenizer spends per
 * character of a given class.
 *
 * Why four classes and not one: the density varies by far more than any single
 * coefficient can absorb. On this engine a Chinese character costs ~1.0 token, a
 * Latin letter ~0.29, and digits and symbols land in between but move with
 * content type (prose, code and JSON differ several-fold). A single number is
 * either ~4x wrong for Chinese or ~2x wrong for code; measuring each class keeps
 * every kind of text within reach.
 *
 * The classes are mutually exclusive on purpose: mixed text is not a fifth class
 * but a combination of these, so one Chinese-and-Latin sentence constrains both
 * densities at once rather than needing its own bucket.
 *
 * The same module is imported by the client (the TPS meter and the live usage
 * estimator) and the server (the in-flight run projection) so the two always
 * agree on what a character costs.
 */

export type CharClass = 'cjk' | 'latin' | 'digit' | 'sym'
export type CharCounts = Record<CharClass, number>
/** Tokens per character, per class. */
export type Density = CharCounts

export const CHAR_CLASSES: readonly CharClass[] = ['cjk', 'latin', 'digit', 'sym']

// CJK ideographs, kana, hangul, CJK punctuation and full-width forms. Full-width
// punctuation counts as CJK because it tokenizes just as densely.
const CJK_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/
const LATIN_RE = /[A-Za-z]/
const DIGIT_RE = /[0-9]/
const WHITESPACE_RE = /\s/

export function emptyCounts(): CharCounts {
  return { cjk: 0, latin: 0, digit: 0, sym: 0 }
}

/** The class of one character, or null for whitespace (which costs no tokens). */
export function classifyChar(ch: string): CharClass | null {
  if (WHITESPACE_RE.test(ch)) return null
  if (CJK_RE.test(ch)) return 'cjk'
  if (LATIN_RE.test(ch)) return 'latin'
  if (DIGIT_RE.test(ch)) return 'digit'
  return 'sym'
}

/** Count a string's characters by class; whitespace is skipped. */
export function classifyChars(text: string): CharCounts {
  const counts = emptyCounts()
  for (const ch of text) {
    const cls = classifyChar(ch)
    if (cls) counts[cls] += 1
  }
  return counts
}

/** Fold `other` into `into` in place and return it (accumulators are hot). */
export function addCounts(into: CharCounts, other: CharCounts): CharCounts {
  into.cjk += other.cjk
  into.latin += other.latin
  into.digit += other.digit
  into.sym += other.sym
  return into
}

/**
 * Densities used before enough samples have been seen.
 *
 * `cjk` and `latin` are measured against this engine (1.003 tokens per Chinese
 * character, 1/3.5 for Latin prose — see the TPS meter's notes). `digit` and
 * `sym` are seeds: their real values move with content type, and learning
 * corrects them as soon as such characters appear in volume.
 */
export const PRIOR_DENSITY: Density = {
  cjk: 1.003,
  latin: 1 / 3.5,
  digit: 0.5,
  sym: 0.35,
}

export function tokensFromCounts(counts: CharCounts, density: Density = PRIOR_DENSITY): number {
  return (
    counts.cjk * density.cjk +
    counts.latin * density.latin +
    counts.digit * density.digit +
    counts.sym * density.sym
  )
}

export function estimateTokens(text: string, density: Density = PRIOR_DENSITY): number {
  return tokensFromCounts(classifyChars(text), density)
}

/** One completed response: what it contained (by class) and what it really cost. */
export type DensitySample = {
  counts: CharCounts
  /** The real `usage.output_tokens` covering exactly the same content as `counts`. */
  tokens: number
}

/** Ridge strength — the weight of the prior, expressed in sample units. */
export const DEFAULT_RIDGE_LAMBDA = 2
/** Below this many samples the prior is used as-is (the maturity gate). */
export const MIN_SAMPLES_TO_LEARN = 10
/** Density is always positive; the bounds only stop a degenerate fit from exploding. */
const DENSITY_MIN = 0.02
const DENSITY_MAX = 8

function clampDensity(value: number): number {
  if (!Number.isFinite(value)) return DENSITY_MIN
  return Math.min(DENSITY_MAX, Math.max(DENSITY_MIN, value))
}

/**
 * Solve a 4x4 system by Gaussian elimination, or null when it is singular.
 * Small and fixed-size because the density fit is exactly four unknowns.
 */
function solve4(matrix: number[][], rhs: number[]): number[] | null {
  const m: number[][] = matrix.map((row, i) => [row[0] ?? 0, row[1] ?? 0, row[2] ?? 0, row[3] ?? 0, rhs[i] ?? 0])
  for (let col = 0; col < 4; col++) {
    let pivot = col
    for (let r = col + 1; r < 4; r++) {
      if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r
    }
    if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-9) return null
    const tmp = m[col] as number[]
    m[col] = m[pivot] as number[]
    m[pivot] = tmp
    const pivotRow = m[col] as number[]
    for (let r = 0; r < 4; r++) {
      if (r === col) continue
      const row = m[r] as number[]
      const factor = (row[col] ?? 0) / (pivotRow[col] ?? 1)
      for (let c = col; c < 5; c++) row[c] = (row[c] ?? 0) - factor * (pivotRow[c] ?? 0)
    }
  }
  return [0, 1, 2, 3].map((i) => (m[i]?.[4] ?? 0) / (m[i]?.[i] ?? 1))
}

/**
 * Fit the four densities to the samples, shrunk toward the prior:
 *
 *     min_k  Σ_s (x_s·k − y_s)²  +  λ · Σ_c (k_c − prior_c)²
 *     ⇒  (XᵀX + λI) k = Xᵀy + λ·prior
 *
 * The shrinkage is what makes a sparse class harmless rather than poisonous: a
 * class with no samples is governed entirely by the prior (a measured value, not
 * a neutral 1.0), and one with a few samples is pulled most of the way back.
 * That is why there is no per-class minimum below which learning is refused —
 * refusing would either stall every class until the rarest one shows up, or, if
 * the floor were lowered, let an unconstrained class run away.
 */
export function learnDensity(
  samples: DensitySample[],
  prior: Density = PRIOR_DENSITY,
  lambda = DEFAULT_RIDGE_LAMBDA,
): Density {
  const xtx: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  const xty = [0, 0, 0, 0]
  for (const sample of samples) {
    if (!(sample.tokens > 0)) continue
    const x = [sample.counts.cjk, sample.counts.latin, sample.counts.digit, sample.counts.sym]
    for (let i = 0; i < 4; i++) {
      const xi = x[i] ?? 0
      if (xi === 0) continue
      const row = xtx[i] as number[]
      for (let j = 0; j < 4; j++) row[j] = (row[j] ?? 0) + xi * (x[j] ?? 0)
      xty[i] = (xty[i] ?? 0) + xi * sample.tokens
    }
  }
  const priorVector = [prior.cjk, prior.latin, prior.digit, prior.sym]
  for (let i = 0; i < 4; i++) {
    ;(xtx[i] as number[])[i] = ((xtx[i] as number[])[i] ?? 0) + lambda
    xty[i] = (xty[i] ?? 0) + lambda * (priorVector[i] ?? 0)
  }
  const solved = solve4(xtx, xty)
  if (!solved) return { ...prior }
  return {
    cjk: clampDensity(solved[0] ?? prior.cjk),
    latin: clampDensity(solved[1] ?? prior.latin),
    digit: clampDensity(solved[2] ?? prior.digit),
    sym: clampDensity(solved[3] ?? prior.sym),
  }
}

/**
 * The density to estimate with, given the samples seen so far: the prior until
 * the pool is mature, the learned fit after. The caller keeps the pool capped
 * (a rolling window), so `samples.length` doubles as the pool size.
 */
export function densityForSamples(
  samples: DensitySample[],
  prior: Density = PRIOR_DENSITY,
  options: { minSamples?: number; lambda?: number } = {},
): Density {
  const min = options.minSamples ?? MIN_SAMPLES_TO_LEARN
  if (samples.length < min) return { ...prior }
  return learnDensity(samples, prior, options.lambda ?? DEFAULT_RIDGE_LAMBDA)
}
