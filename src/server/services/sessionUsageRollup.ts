import { getOutputTokenCountFromUsage, getReasoningTokenCountFromUsage } from '../../utils/tokens.js'
import { roughTokenCountEstimationForThinking } from '../../services/tokenEstimation.js'
import { shouldSendThinkingToAPI } from '../../utils/thinking.js'
import { sessionService } from './sessionService.js'
import type { RawEntry, SessionTaskNotification } from './sessionService.js'

type ReportedUsage = Parameters<typeof getOutputTokenCountFromUsage>[0]

/**
 * Token usage a single subagent run generated, derived from its own transcript.
 *
 * The parent session's result text is not a usable source for this. It carries
 * one `total_tokens` line that older runs wrote with the *context window* of the
 * agent's last call — which describes what the run had read rather than what it
 * produced — and it carries no thinking split at all. The agent's own transcript
 * has both, per turn, so this is what the UI reads once a session is opened
 * again instead of streamed live.
 */
export type SubagentUsage = {
  /** Generated tokens — the run's "usage", matching the live notification. */
  totalTokens: number
  outputTokens: number
  /** Thinking share; absent when thinking is sent to the API (see the gate). */
  thinkTokens?: number
  toolUses: number
}

function countToolUsesInEntries(entries: readonly RawEntry[]): number {
  let count = 0
  for (const entry of entries) {
    if (entry.type !== 'assistant') continue
    const content = entry.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'tool_use') {
        count += 1
      }
    }
  }
  return count
}

/**
 * Sum one agent's generated tokens, and the thinking share of them.
 *
 * Mirrors the live path (`finalizeAgentTool`): per turn, the engine's own
 * reasoning count wins, and a turn it did not measure is estimated from the
 * thinking that turn produced. Per turn rather than per run, because a reported
 * turn already covers its own thinking.
 *
 * A reported `0` means the engine measured no thinking, which is not a
 * measurement of thinking the transcript plainly contains — so anything not
 * strictly positive falls through to the estimate. Treating `0` as "measured" is
 * what silently suppressed the split on engines that report the field as 0.
 *
 * Returns `undefined` when nothing was generated, so a caller can tell "no
 * usage" from "zero usage" — the bar renders nothing rather than "0k".
 */
export function computeSubagentUsage(entries: readonly RawEntry[]): SubagentUsage | undefined {
  let outputTokens = 0
  let sawOutput = false
  // Grouped by response, because a streamed response arrives as several records:
  // the thinking one alone (carrying no usage of its own), then the text one with
  // the usage. Only the latter can report reasoning, so estimating the thinking
  // record *and* adding its sibling's real count counts the same thinking twice —
  // a run then reports more thinking than it generated and the UI's
  // `total - think` collapses to zero. A reported count wins for its response;
  // the estimate is kept only where nothing was reported.
  const reportedThinkByResponse = new Map<string, number>()
  const estimatedThinkByResponse = new Map<string, number>()

  for (const [index, entry] of entries.entries()) {
    if (entry.type !== 'assistant') continue
    const usage = entry.message?.usage
    if (!usage) continue
    const reportedUsage = usage as unknown as ReportedUsage

    const output = getOutputTokenCountFromUsage(reportedUsage)
    if (output > 0) {
      outputTokens += output
      sawOutput = true
    }

    // A record with no id cannot be grouped with its siblings, so it stands
    // alone — the old behavior, which is right for a single-record response.
    const responseId = entry.message?.id ?? `__record_${index}`
    const reported = getReasoningTokenCountFromUsage(reportedUsage)
    if (reported !== undefined && reported > 0) {
      reportedThinkByResponse.set(
        responseId,
        (reportedThinkByResponse.get(responseId) ?? 0) + reported,
      )
      continue
    }
    const estimate = roughTokenCountEstimationForThinking(
      entry.message?.content as Parameters<typeof roughTokenCountEstimationForThinking>[0],
    )
    if (estimate > 0) {
      estimatedThinkByResponse.set(
        responseId,
        (estimatedThinkByResponse.get(responseId) ?? 0) + estimate,
      )
    }
  }

  let thinkTokens = 0
  for (const reported of reportedThinkByResponse.values()) thinkTokens += reported
  for (const [responseId, estimate] of estimatedThinkByResponse) {
    if (!reportedThinkByResponse.has(responseId)) thinkTokens += estimate
  }

  if (!sawOutput) return undefined
  return {
    totalTokens: outputTokens,
    outputTokens,
    ...(thinkTokens > 0 ? { thinkTokens } : {}),
    toolUses: countToolUsesInEntries(entries),
  }
}

const CACHE_CAPACITY = 32

/** The slice of the session service this needs; injectable so it can be tested. */
export type UsageRollupSource = Pick<
  typeof sessionService,
  'getSessionMessagesSignature' | 'listSubagentSidecars' | 'readSubagentTranscriptEntries'
>

/**
 * Derives each subagent's token usage from the subagents' own transcripts, so a
 * session read back from disk shows the split the live run would have shown
 * instead of the single context-based total its result text happens to hold.
 *
 * Cached per session against the message signature, which already folds in every
 * child transcript's size and mtime — a running agent therefore invalidates its
 * own entry without this having to watch files.
 */
export class SessionUsageRollup {
  private readonly cache = new Map<string, { signature: string; byToolUseId: Map<string, SubagentUsage> }>()

  constructor(private readonly source: UsageRollupSource = sessionService) {}

  /** One usage entry per Agent call whose subagent transcript could be resolved. */
  async byToolUseId(sessionId: string): Promise<Map<string, SubagentUsage>> {
    let signature: string | null
    try {
      signature = await this.source.getSessionMessagesSignature(sessionId)
    } catch {
      return new Map()
    }
    if (signature === null) return new Map()

    const cached = this.cache.get(sessionId)
    if (cached && cached.signature === signature) return cached.byToolUseId

    const derived = await this.derive(sessionId)
    this.cache.delete(sessionId)
    this.cache.set(sessionId, { signature, byToolUseId: derived })
    if (this.cache.size > CACHE_CAPACITY) {
      const oldest = this.cache.keys().next()
      if (!oldest.done) this.cache.delete(oldest.value)
    }
    return derived
  }

  private async derive(sessionId: string): Promise<Map<string, SubagentUsage>> {
    const result = new Map<string, SubagentUsage>()
    let sidecars: Awaited<ReturnType<UsageRollupSource['listSubagentSidecars']>>
    try {
      sidecars = await this.source.listSubagentSidecars(sessionId)
    } catch {
      return result
    }

    // Root agents only. An owned sidecar answers to its parent's tool call and
    // the group bar reads root calls; counting it here would also attribute one
    // toolUseId to several transcripts when a fan-out shares it.
    const seenToolUseId = new Set<string>()
    for (const sidecar of sidecars.sidecars) {
      if (sidecar.ownerAgentId !== undefined) continue
      if (seenToolUseId.has(sidecar.toolUseId)) continue
      seenToolUseId.add(sidecar.toolUseId)
      try {
        const entries = await this.source.readSubagentTranscriptEntries(sessionId, sidecar.agentId)
        const usage = computeSubagentUsage(entries)
        if (usage) result.set(sidecar.toolUseId, usage)
      } catch {
        // One unreadable agent must not cost the session its whole rollup.
      }
    }
    return result
  }
}

export const sessionUsageRollup = new SessionUsageRollup()

/**
 * Attach already-derived usage to a session's task notifications.
 *
 * An existing `usage` wins: a live notification already carries the engine's own
 * numbers, and the derived ones exist only to fill the gap left when a session
 * is read back. The thinking share is attached only while thinking is withheld
 * from the API, mirroring the live gate — otherwise a reader would show a split
 * the live path deliberately does not, decided by nothing but which of the two
 * paths happened to produce the number.
 */
export function attachUsageToNotifications(
  notifications: readonly SessionTaskNotification[],
  byToolUseId: ReadonlyMap<string, SubagentUsage>,
  includeThink: boolean,
): SessionTaskNotification[] {
  if (byToolUseId.size === 0) return [...notifications]
  return notifications.map(notification => {
    if (notification.usage) return notification
    const usage = byToolUseId.get(notification.toolUseId)
    if (!usage) return notification
    return {
      ...notification,
      usage: {
        totalTokens: usage.totalTokens,
        outputTokens: usage.outputTokens,
        ...(includeThink && usage.thinkTokens !== undefined ? { thinkTokens: usage.thinkTokens } : {}),
        toolUses: usage.toolUses,
      },
    }
  })
}

/** {@link attachUsageToNotifications} against the shared rollup cache. */
export async function enrichTaskNotificationsWithUsage(
  sessionId: string,
  notifications: readonly SessionTaskNotification[],
): Promise<SessionTaskNotification[]> {
  if (notifications.length === 0) return [...notifications]
  const byToolUseId = await sessionUsageRollup.byToolUseId(sessionId)
  return attachUsageToNotifications(notifications, byToolUseId, !shouldSendThinkingToAPI())
}
