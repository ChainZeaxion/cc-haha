// Tail-keep cut for VCC compaction, adapted from pi-vcc's before-compact hook
// (buildOwnCut / applyTailBudget / resolveSmartKeepUserTurns, 0.8.0).
//
// pi-vcc operates on pi session entries (with nested compaction records);
// cc-haha hands us the in-memory window already projected past the last
// compact boundary (getMessagesAfterCompactBoundary), so the cut is applied
// directly on the adapted PiMessage[] array.
//
// The cut is found in pi-message space (user-turn anchoring / token budget)
// but expressed as a cc-message anchor (`keptCcStart`) so CompactionResult
// can keep a contiguous run of whole cc messages — a single cc message that
// emitted several pi messages (e.g. Bash execution + tool results) is never
// split across the boundary.
//
// Semantics preserved:
//  - keep:N user-turns at the tail are kept verbatim (passed back as
//    messagesToKeep through CompactionResult);
//  - smart keep: when the keep:1 tail is small (<= MIN tokens), grow keep to
//    the largest N whose tail stays <= MAX tokens;
//  - oversized tail (> MAX * factor) is re-cut on a token budget at the
//    nearest non-toolResult boundary;
//  - no usable boundary (single user prompt, etc.) → compact everything.
import type { Message } from "./pi-ai"
import {
  estimateMessageContentTokens,
  estimateTokensFromChars,
  calibrateCharsPerToken,
  estimateMessageContentChars,
  type TokenEstimateCalibration,
} from "./vendor/core/token-estimate"

export const MIN_SMART_TAIL_TOKENS = 5_000
export const MAX_SMART_TAIL_TOKENS = 25_000
export const OVERSIZED_TAIL_FACTOR = 2.5

/**
 * How much of the context a compaction may keep verbatim, minus whatever the
 * summary itself costs.
 *
 * Two numbers rather than one because a tail is not freely divisible: the
 * messages worth keeping are whole turns, and the newest turn may be larger
 * than the target on its own.
 *
 * - `preferredTokens` — the budget to fill and to stay inside. The retained
 *   tail is grown to use it, so the post-compaction context sits where the
 *   forced trigger intends rather than in some arbitrary smaller place.
 * - `ceilingTokens` — what may be kept when the newest turn does not fit the
 *   target. Past it the tail is cut down from the end.
 */
export interface TailAllowance {
  preferredTokens: number
  ceilingTokens: number
}

export interface VccCutResult {
  ok: boolean
  /** Pi messages to summarize (everything before the kept tail). */
  toSummarize: Message[]
  /** Global `#N` indices parallel to `toSummarize`. */
  toSummarizeIndices: Array<number | undefined>
  /** cc-message index where the kept tail begins; `ccMessages.slice(keptCcStart)`
   *   is the messagesToKeep. Equals `ccMessages.length` when compacting all. */
  keptCcStart: number
  keptUserTurns: number
  totalUserTurns: number
  keepFallbackToCompactAll: boolean
  budgetCut: "none" | "no_anchor" | "oversized_tail"
}

interface CutCore {
  cutPi: number
  keptUserTurns: number
  keepFallbackToCompactAll: boolean
  budgetCut: VccCutResult["budgetCut"]
}

const userTurnsOf = (messages: Message[]): number[] =>
  messages.reduce<number[]>((acc, m, i) => {
    if (m.role === "user") acc.push(i)
    return acc
  }, [])

/**
 * Split the window into (toSummarize, toKeep). `keepUserTurns` is the
 * smart-keep resolved value; the tail budget re-cut may lower the effective
 * kept region when the tail is oversized.
 */
export const buildVccCut = (
  messages: Message[],
  sourceIndices: Array<number | undefined>,
  ccIndices: number[],
  keepUserTurns: number,
  opts: { charsPerToken?: number; tailAllowance?: TailAllowance } = {},
): VccCutResult => {
  const totalUserTurns = userTurnsOf(messages).length
  const finish = (core: CutCore): VccCutResult => {
    const keptCcStart =
      core.cutPi >= messages.length
        ? ccIndices[ccIndices.length - 1] + 1 // compact-all: nothing kept
        : ccIndices[core.cutPi]
    return {
      ok: true,
      toSummarize: messages.slice(0, core.cutPi),
      toSummarizeIndices: sourceIndices.slice(0, core.cutPi),
      keptCcStart,
      keptUserTurns: core.keptUserTurns,
      totalUserTurns,
      keepFallbackToCompactAll: core.keepFallbackToCompactAll,
      budgetCut: core.budgetCut,
    }
  }

  if (messages.length === 0)
    return {
      ok: false,
      toSummarize: [],
      toSummarizeIndices: [],
      keptCcStart: 0,
      keptUserTurns: 0,
      totalUserTurns: 0,
      keepFallbackToCompactAll: false,
      budgetCut: "none",
    }
  if (messages.length <= 2)
    return finish({ cutPi: messages.length, keptUserTurns: 0, keepFallbackToCompactAll: true, budgetCut: "none" })

  const userIndices = userTurnsOf(messages)
  if (keepUserTurns <= 0)
    return finish({ cutPi: messages.length, keptUserTurns: 0, keepFallbackToCompactAll: false, budgetCut: "none" })

  const target = userIndices.length - keepUserTurns
  const cutIdx = target >= 0 ? userIndices[target] : -1
  if (cutIdx <= 0)
    // Single user prompt (or keep larger than available turns): no safe
    // boundary, summarize everything (mirrors pi-vcc's compact-all fallback).
    return finish({ cutPi: messages.length, keptUserTurns: 0, keepFallbackToCompactAll: true, budgetCut: "none" })

  const cpt = opts.charsPerToken
  let tailTokens = 0
  for (let i = cutIdx; i < messages.length; i++)
    tailTokens += estimateMessageContentTokens(messages[i].content, cpt)

  // Token-budget tail re-cut. With an allowance the ceiling is the one the
  // compaction budget set; without one it keeps the pre-budget rule (fires only
  // past MAX * OVERSIZED_TAIL_FACTOR, mirrors pi-vcc's applyTailBudget case B).
  const allowance = opts.tailAllowance

  if (allowance) {
    if (tailTokens > allowance.ceilingTokens) {
      // The largest *suffix* that fits, so what is kept is as much of the recent
      // past as the ceiling pays for. A tail is kept in whole messages: the
      // newest message may be larger than the whole ceiling, and then nothing
      // fits — keeping it anyway would leave the context no safer than before
      // compacting, which is the opposite of what a compaction is for.
      const start = largestSuffixWithin(messages, allowance.ceilingTokens, cpt)
      if (start >= messages.length)
        return finish({
          cutPi: messages.length,
          keptUserTurns: 0,
          keepFallbackToCompactAll: true,
          budgetCut: "oversized_tail",
        })
      // Snap forward off any toolResult to the next valid boundary.
      let idx = start
      for (let j = Math.max(start, 1); j < messages.length; j++) {
        if (messages[j].role !== "toolResult") {
          idx = j
          break
        }
      }
      if (idx > cutIdx)
        return finish({
          cutPi: idx,
          keptUserTurns: messages.slice(idx).filter((m) => m.role === "user").length,
          keepFallbackToCompactAll: false,
          budgetCut: "oversized_tail",
        })
    }
  } else if (tailTokens > MAX_SMART_TAIL_TOKENS * OVERSIZED_TAIL_FACTOR) {
    let acc = 0
    let crossed = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      acc += estimateMessageContentTokens(messages[i].content, cpt)
      if (acc >= MAX_SMART_TAIL_TOKENS) {
        crossed = i
        break
      }
    }
    if (crossed > 0) {
      // Snap forward off any toolResult to the next valid boundary.
      let idx = crossed
      for (let j = Math.max(crossed, 1); j < messages.length; j++) {
        if (messages[j].role !== "toolResult") {
          idx = j
          break
        }
      }
      if (idx > cutIdx)
        return finish({
          cutPi: idx,
          keptUserTurns: messages.slice(idx).filter((m) => m.role === "user").length,
          keepFallbackToCompactAll: false,
          budgetCut: "oversized_tail",
        })
    }
  }

  return finish({
    cutPi: cutIdx,
    keptUserTurns: userIndices.length - target,
    keepFallbackToCompactAll: false,
    budgetCut: "none",
  })
}

/**
 * Index of the first message of the longest trailing run whose tokens fit
 * `budget`, or `messages.length` when even the last one does not.
 */
const largestSuffixWithin = (
  messages: Message[],
  budget: number,
  cpt?: number,
): number => {
  let acc = 0
  let start = messages.length
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateMessageContentTokens(messages[i].content, cpt)
    if (acc + tokens > budget) break
    acc += tokens
    start = i
  }
  return start
}

const tailTokensForKeep = (
  messages: Message[],
  userIndices: number[],
  keepUserTurns: number,
  charsPerToken?: number,
): number | null => {
  const target = userIndices.length - keepUserTurns
  const cutIdx = target >= 0 ? userIndices[target] : -1
  if (cutIdx <= 0) return null
  let chars = 0
  for (let i = cutIdx; i < messages.length; i++)
    chars += estimateMessageContentChars(messages[i].content)
  return estimateTokensFromChars(chars, charsPerToken)
}

/**
 * Smart keep-tail: grow the kept tail to the largest N turns that fits.
 *
 * With `allowance` the budget is the context the compaction is meant to leave
 * behind, so the tail is grown to *use* it — landing under the target is fine
 * but landing far under it throws away verbatim history the target had already
 * paid for. The newest turn is kept regardless of the target; {@link buildVccCut}
 * is what enforces the ceiling when that turn does not fit.
 *
 * Without one (the slice/partial path, and pi-vcc parity callers) it falls back
 * to the fixed MIN/MAX pair: grow only when keep:1 came in under MIN.
 */
export const resolveSmartKeepUserTurns = (
  messages: Message[],
  calibration: TokenEstimateCalibration,
  allowance?: TailAllowance,
): { keepUserTurns: number; smartAdjusted: boolean; fromKeep: number } => {
  const userIndices = userTurnsOf(messages)
  const baseKeep = 1
  const cpt = calibration.charsPerToken

  const baseTokens = tailTokensForKeep(messages, userIndices, baseKeep, cpt)

  if (allowance) {
    if (baseTokens == null)
      return { keepUserTurns: baseKeep, smartAdjusted: false, fromKeep: baseKeep }
    // `tailTokensForKeep` only grows with `k`, so a newest turn that is already
    // over the target simply ends the loop at one turn kept.
    let selected = baseKeep
    for (let k = baseKeep + 1; k <= userIndices.length; k++) {
      const tokens = tailTokensForKeep(messages, userIndices, k, cpt)
      if (tokens == null || tokens > allowance.preferredTokens) break
      selected = k
    }
    return {
      keepUserTurns: selected,
      smartAdjusted: selected !== baseKeep,
      fromKeep: baseKeep,
    }
  }

  if (baseTokens == null || baseTokens > MIN_SMART_TAIL_TOKENS)
    return { keepUserTurns: baseKeep, smartAdjusted: false, fromKeep: baseKeep }

  let selected = baseKeep
  for (let k = baseKeep + 1; k <= userIndices.length; k++) {
    const tokens = tailTokensForKeep(messages, userIndices, k, cpt)
    if (tokens == null || tokens > MAX_SMART_TAIL_TOKENS) break
    selected = k
  }
  return {
    keepUserTurns: selected,
    smartAdjusted: selected !== baseKeep,
    fromKeep: baseKeep,
  }
}

/**
 * Calibrate chars/token from the window's pre-compact token count. Uses the
 * same heuristic fallback as pi-vcc when the count is unavailable.
 */
export const calibrateFromWindow = (
  messages: Message[],
  preCompactTokenCount: number | undefined,
): TokenEstimateCalibration => {
  let chars = 0
  for (const m of messages) chars += estimateMessageContentChars(m.content)
  return calibrateCharsPerToken(chars, preCompactTokenCount)
}
