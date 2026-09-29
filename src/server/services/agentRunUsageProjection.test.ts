import { afterEach, describe, expect, test } from 'bun:test'
import {
  clearAgentRunUsage,
  observeAgentRunUsage,
  projectAgentRunUsage,
  resetAgentRunUsageForTests,
} from './agentRunUsageProjection.js'

const SESSION = 'projection-session'
const RUN = 'a74ce8'
const TOOL_CALL = 'call_00_s8R2abcdef'

function taskStarted(taskId = RUN, toolUseId = TOOL_CALL): any {
  return { type: 'system', subtype: 'task_started', task_id: taskId, tool_use_id: toolUseId }
}

function delta(runAgentId: string, delta: Record<string, unknown>): any {
  return {
    type: 'system',
    subtype: 'agent_run_message',
    run_agent_id: runAgentId,
    stream_id: 'stream-1',
    target_agent_id: runAgentId,
    event_kind: 'message',
    message: { type: 'stream_event', event: { type: 'content_block_delta', delta } },
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

    // 480 characters over the client's divisor.
    expect(run()).toMatchObject({ taskId: RUN, toolUseId: TOOL_CALL, totalTokens: 120, thinkTokens: 20 })
  })

  test('counts tool-argument JSON as generation, alongside the text', () => {
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'input_json_delta', partial_json: '{"a":1}' }))

    expect(run()?.totalTokens).toBe(2)
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

    expect(run()?.totalTokens).toBe(10)
  })

  test('counts an assistant message that never streamed', () => {
    // The non-streaming fallback: there were no deltas, so the whole message is the
    // only record of the content.
    observeAgentRunUsage(SESSION, assistantMessage(RUN, 'msg-2', [{ type: 'text', text: 'x'.repeat(40) }]))

    expect(run()?.totalTokens).toBe(10)
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
      .toEqual([['run-b', 30], ['run-a', 10]])
  })

  test('keeps sessions apart, and forgets one on clear', () => {
    observeAgentRunUsage(SESSION, delta(RUN, { type: 'text_delta', text: 'x'.repeat(40) }))
    observeAgentRunUsage('other-session', delta(RUN, { type: 'text_delta', text: 'x'.repeat(80) }))

    expect(projectAgentRunUsage(SESSION)[0]?.totalTokens).toBe(10)
    expect(projectAgentRunUsage('other-session')[0]?.totalTokens).toBe(20)

    clearAgentRunUsage(SESSION)
    expect(projectAgentRunUsage(SESSION)).toEqual([])
    expect(projectAgentRunUsage('other-session')[0]?.totalTokens).toBe(20)
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
