import { afterEach, describe, expect, test } from 'bun:test'
import {
  clearAgentRunUsage,
  observeAgentRunUsage,
  projectAgentRunUsage,
  resetAgentRunUsageForTests,
} from './agentRunUsageProjection.js'
import { PRIOR_DENSITY, tokensFromCounts } from '../../shared/tokenDensity.js'

const SESSION = 'projection-session'
const RUN = 'a74ce8'
const TOOL_CALL = 'call_00_s8R2abcdef'

function taskStarted(taskId = RUN, toolUseId = TOOL_CALL): any {
  return { type: 'system', subtype: 'task_started', task_id: taskId, tool_use_id: toolUseId }
}

function delta(runAgentId: string, delta: Record<string, unknown>, extra: Record<string, unknown> = {}): any {
  return {
    type: 'system',
    subtype: 'agent_run_message',
    run_agent_id: runAgentId,
    stream_id: 'stream-1',
    target_agent_id: runAgentId,
    event_kind: 'message',
    message: { type: 'stream_event', event: { type: 'content_block_delta', delta, ...extra } },
  }
}

function messageStart(runAgentId: string, id: string): any {
  return {
    type: 'system',
    subtype: 'agent_run_message',
    run_agent_id: runAgentId,
    stream_id: 'stream-1',
    target_agent_id: runAgentId,
    event_kind: 'message',
    message: { type: 'stream_event', event: { type: 'message_start', message: { id } } },
  }
}

function assistantMessage(runAgentId: string, id: string, blocks: unknown[]): any {
  return {
    type: 'system',
    subtype: 'agent_run_message',
    run_agent_id: runAgentId,
    stream_id: 'stream-1',
    target_agent_id: runAgentId,
    event_kind: 'message',
    message: { type: 'assistant', id, content: blocks },
  }
}

/** The shared estimator's own arithmetic, so these cases pin the counting, not the density. */
function est(counts: { cjk?: number; latin?: number; digit?: number; sym?: number }): number {
  return Math.round(
    tokensFromCounts({ cjk: 0, latin: 0, digit: 0, sym: 0, ...counts }, PRIOR_DENSITY),
  )
}
const LATIN = (n: number) => est({ latin: n })

function run(taskId = RUN) {
  return projectAgentRunUsage(SESSION).find(entry => entry.taskId === taskId)
}

afterEach(() => {
  resetAgentRunUsageForTests()
})

describe('agent run usage projection', () => {
  test('counts streamed text and thinking for the run they belong to', () => {
    observeAgentRunUsage(SESSION, taskStarted())
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'text_delta', text: 'x'.repeat(400) }))
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'thinking_delta', thinking: 'y'.repeat(80) }))

    expect(run()).toMatchObject({
      taskId: RUN,
      toolUseId: TOOL_CALL,
      totalTokens: LATIN(400) + LATIN(80),
      thinkTokens: LATIN(80),
    })
  })

  test('counts Chinese at its real density, not at the Latin one', () => {
    // The point of the four-class estimator: 40 Chinese characters cost ~40
    // tokens, while 40 Latin characters cost ~11 — the old flat /4 called both 10.
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'text_delta', text: '思'.repeat(40) }))

    expect(run()?.totalTokens).toBe(est({ cjk: 40 }))
    expect(run()?.totalTokens).toBeGreaterThan(LATIN(40) * 3)
  })

  test('counts tool-argument JSON as generation, alongside the text', () => {
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'input_json_delta', partial_json: '{"a":1}' }))

    // 1 latin, 1 digit, 5 symbols.
    expect(run()?.totalTokens).toBe(est({ latin: 1, digit: 1, sym: 5 }))
  })

  test('prefers the engine’s real token ids when the delta carries them', () => {
    // The Anthropic passthrough relays the engine's per-chunk ids verbatim, so a
    // run that reports them is measured exactly rather than estimated.
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'text_delta', text: 'x'.repeat(400) }, { token_ids: [1, 2, 3] }))
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'thinking_delta', thinking: 'y'.repeat(80) }, { token_ids: [4, 5] }))

    expect(run()).toMatchObject({ totalTokens: 5, thinkTokens: 2 })
  })

  test('carries both ids, which is the point of the exercise', () => {
    observeAgentRunUsage(SESSION, taskStarted())

    // The task id is the run's own; the tool-use id is the Agent call that spawned
    // it. A client that joined mid-run never saw this frame, so the pair has to
    // travel with the number.
    expect(run()).toMatchObject({ taskId: RUN, toolUseId: TOOL_CALL, totalTokens: 0 })
  })

  test('reports a run it has counted nothing for yet', () => {
    // Just started: the point is that it is *known*, so a joining client has
    // something to attach its own climb to instead of starting from nothing.
    observeAgentRunUsage(SESSION, taskStarted())

    expect(projectAgentRunUsage(SESSION)).toEqual([
      { taskId: RUN, toolUseId: TOOL_CALL, totalTokens: 0, thinkTokens: 0 },
    ])
  })

  test('does not count an assistant message whose content already streamed', () => {
    // The stream announces its message id, then streams the text.
    observeAgentRunUsage(SESSION, messageStart(RUN, 'msg-1'))
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'text_delta', text: 'x'.repeat(40) }))
    // Same message arriving whole afterward: its text was counted delta by delta.
    observeAgentRunUsage(SESSION, assistantMessage(RUN, 'msg-1', [{ type: 'text', text: 'x'.repeat(40) }]))

    expect(run()?.totalTokens).toBe(LATIN(40))
  })

  test('counts an assistant message that never streamed', () => {
    // The non-streaming fallback: there were no deltas, so the whole message is the
    // only record of the content.
    observeAgentRunUsage(SESSION, assistantMessage(RUN, 'msg-2', [{ type: 'text', text: 'x'.repeat(40) }]))

    expect(run()?.totalTokens).toBe(LATIN(40))
  })

  test('ignores a whole-message thinking block, which the deltas already covered', () => {
    // The watching client counts only streamed thinking (`complete !== true`);
    // counting this again would put the seed above what an attached client shows.
    observeAgentRunUsage(SESSION, assistantMessage(RUN, 'msg-3', [{ type: 'thinking', thinking: 'y'.repeat(80) }]))

    expect(run()?.totalTokens).toBe(0)
    expect(run()?.thinkTokens).toBe(0)
  })

  test('keeps runs apart', () => {
    observeAgentRunUsage(SESSION, delta('run-a', { type: 'text_delta', text: 'x'.repeat(40) }))
    observeAgentRunUsage(SESSION, delta('run-b', { type: 'text_delta', text: 'x'.repeat(120) }))

    expect(projectAgentRunUsage(SESSION).map(entry => [entry.taskId, entry.totalTokens]))
      .toEqual([['run-b', LATIN(120)], ['run-a', LATIN(40)]])
  })

  test('keeps sessions apart, and forgets one on clear', () => {
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'text_delta', text: 'x'.repeat(40) }))
    observeAgentRunUsage('other-session', delta(RUN, { type: 'text_delta', text: 'x'.repeat(80) }))

    expect(projectAgentRunUsage(SESSION)[0]?.totalTokens).toBe(LATIN(40))
    expect(projectAgentRunUsage('other-session')[0]?.totalTokens).toBe(LATIN(80))

    clearAgentRunUsage(SESSION)
    expect(projectAgentRunUsage(SESSION)).toEqual([])
    expect(projectAgentRunUsage('other-session')[0]?.totalTokens).toBe(LATIN(80))
  })

  test('ignores everything that is not part of a subagent run', () => {
    observeAgentRunUsage(SESSION, { type: 'assistant', message: { content: [] } })
    observeAgentRunUsage(SESSION, { type: 'system', subtype: 'task_started' })
    observeAgentRunUsage(SESSION, delta('', { type: 'text_delta', text: 'x' }))
    observeAgentRunUsage(SESSION, {
      type: 'system', subtype: 'agent_run_message', run_agent_id: RUN, event_kind: 'complete',
    })

    expect(projectAgentRunUsage(SESSION)).toEqual([])
  })
})
