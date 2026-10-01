/**
 * How much output each in-flight subagent run has produced, estimated on the
 * server as the run streams.
 *
 * Why the server has to do this at all: a client that opens a session while a
 * subagent is working has nothing to start from. Its own counters begin at zero,
 * so it climbs from zero, while a client that was there from the start already
 * shows the real figure — the two disagree for as long as the run lasts. The only
 * other source, the transcript-derived rollup, states a run's total *only at a
 * tool boundary*; inside a long single generation it is silent, which is precisely
 * the stretch where the disagreement is most visible.
 *
 * The server is in the one position to close that gap: every streamed frame of the
 * run passes through it. So it counts, per run, exactly what a watching client
 * counts — same deltas, same divisor — and hands the result over as the starting
 * figure. Nothing here is authoritative; a boundary or the run's completion
 * supersedes it. Its job is only to make a late arrival land at the right place
 * instead of at zero.
 *
 * The counting rule deliberately mirrors the client's live estimator
 * (`ingestSubagentLiveUsage`), including which events it does *not* count: a
 * `thinking` block that arrives whole as part of an assistant message is already
 * covered by the deltas that streamed it, and counting it again would inflate the
 * number past what the watching client shows.
 */

/** One run's streamed output so far. Characters, not tokens — see `estimate`. */
type RunProjection = {
  runAgentId: string
  /** The Agent tool call that spawned the run, once a lifecycle frame says so. */
  toolUseId?: string
  text: number
  thinking: number
  /**
   * Assistant message ids whose blocks already arrived as stream deltas, so the
   * whole-message form of the same content is skipped rather than added twice.
   */
  streamedMessageIds: Set<string>
  updatedAt: number
}

/**
 * Runs kept per session before the least recently touched are dropped. A session
 * holds a handful of concurrent subagents; the cap only exists so a long-lived
 * session cannot accumulate an entry per run it ever started.
 */
const MAX_RUNS_PER_SESSION = 64

/** Characters per token. Matches the client estimator, so the two agree. */
const CHARS_PER_TOKEN = 4

const projections = new Map<string, Map<string, RunProjection>>()

function sessionRuns(sessionId: string): Map<string, RunProjection> {
  let runs = projections.get(sessionId)
  if (!runs) {
    runs = new Map()
    projections.set(sessionId, runs)
  }
  return runs
}

function runFor(sessionId: string, runAgentId: string): RunProjection {
  const runs = sessionRuns(sessionId)
  let run = runs.get(runAgentId)
  if (!run) {
    run = {
      runAgentId,
      text: 0,
      thinking: 0,
      streamedMessageIds: new Set(),
      updatedAt: Date.now(),
    }
    runs.set(runAgentId, run)
    if (runs.size > MAX_RUNS_PER_SESSION) {
      // Map preserves insertion order, so the first key is the oldest run. Runs
      // that are still going are re-touched on every frame, so what ages out is
      // one that has gone quiet.
      const oldest = runs.keys().next()
      if (!oldest.done && oldest.value !== runAgentId) runs.delete(oldest.value)
    }
  }
  return run
}

function trim(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function noteStreamedMessage(run: RunProjection, messageId: string): void {
  run.streamedMessageIds.add(messageId)
  if (run.streamedMessageIds.size > MAX_RUNS_PER_SESSION) {
    const oldest = run.streamedMessageIds.values().next()
    if (!oldest.done) run.streamedMessageIds.delete(oldest.value)
  }
}

/**
 * Count one CLI message toward the run it belongs to.
 *
 * Called for every message of a session, so it returns early for anything that is
 * not part of a subagent run.
 */
export function observeAgentRunUsage(sessionId: string, cliMsg: any): void {
  if (!cliMsg || typeof cliMsg !== 'object' || cliMsg.type !== 'system') return

  // The lifecycle frames are where the two ids a run goes by are related: the task
  // id is the run's own, the tool-use id is the Agent call that spawned it. Without
  // this the counts could not be attributed to anything the UI renders.
  if (cliMsg.subtype === 'task_started' || cliMsg.subtype === 'task_progress') {
    const taskId = trim(cliMsg.task_id)
    if (!taskId) return
    const run = runFor(sessionId, taskId)
    const toolUseId = trim(cliMsg.tool_use_id)
    if (toolUseId) run.toolUseId = toolUseId
    return
  }

  if (cliMsg.subtype !== 'agent_run_message' || cliMsg.event_kind !== 'message') return
  const runAgentId = trim(cliMsg.run_agent_id)
  if (!runAgentId) return
  const message = cliMsg.message
  if (!message || typeof message !== 'object') return
  const run = runFor(sessionId, runAgentId)

  if (message.type === 'stream_event') {
    const event = message.event
    // A message announcing itself as streamed is what lets the whole-message form
    // of the same content be recognised and skipped below.
    if (event?.type === 'message_start') {
      const messageId = trim(event.message?.id)
      if (messageId) noteStreamedMessage(run, messageId)
      return
    }
    if (event?.type !== 'content_block_delta') return
    const delta = event.delta
    if (!delta) return
    if (delta.type === 'text_delta' && typeof delta.text === 'string') {
      run.text += delta.text.length
    } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
      // Tool arguments are generation too, and the watching client counts them
      // alongside the visible text.
      run.text += delta.partial_json.length
    } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
      run.thinking += delta.thinking.length
    } else {
      return
    }
    run.updatedAt = Date.now()
    return
  }

  if (message.type === 'assistant') {
    const messageId = trim(message.id)
    if (messageId) {
      // A message that streamed its blocks already counted them delta by delta.
      if (run.streamedMessageIds.has(messageId)) return
      noteStreamedMessage(run, messageId)
    }
    for (const block of Array.isArray(message.content) ? message.content : []) {
      // Only text: a thinking block arriving whole was streamed, and the client
      // does not count the whole-message form of it either.
      if (block?.type === 'text' && typeof block.text === 'string') run.text += block.text.length
    }
    run.updatedAt = Date.now()
  }
}

/** What one in-flight run is estimated to have produced so far. */
export type ProjectedRunUsage = {
  taskId: string
  toolUseId?: string
  totalTokens: number
  thinkTokens: number
}

/**
 * The estimate for every run this session has counted, most recently active first.
 *
 * Runs with nothing to report are included: a run that has only just started is
 * still a run a late client needs to know about, and `totalTokens: 0` says exactly
 * that rather than hiding it.
 */
export function projectAgentRunUsage(sessionId: string): ProjectedRunUsage[] {
  const runs = projections.get(sessionId)
  if (!runs) return []
  const projected: ProjectedRunUsage[] = []
  for (const run of runs.values()) {
    const thinkTokens = Math.round(run.thinking / CHARS_PER_TOKEN)
    projected.push({
      taskId: run.runAgentId,
      ...(run.toolUseId ? { toolUseId: run.toolUseId } : {}),
      totalTokens: Math.round((run.text + run.thinking) / CHARS_PER_TOKEN),
      thinkTokens,
    })
  }
  projected.sort((a, b) => b.totalTokens - a.totalTokens)
  return projected
}

/** Drop everything counted for a session. Its CLI process is gone. */
export function clearAgentRunUsage(sessionId: string): void {
  projections.delete(sessionId)
}

/** Test seam: the module holds per-session state, so cases must not share it. */
export function resetAgentRunUsageForTests(): void {
  projections.clear()
}
