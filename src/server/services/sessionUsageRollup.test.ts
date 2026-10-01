import { describe, expect, it } from 'bun:test'
import {
  SessionUsageRollup,
  attachUsageToNotifications,
  computeSubagentUsage,
  type SubagentUsage,
  type UsageRollupSource,
} from './sessionUsageRollup.js'
import type { RawEntry, SessionTaskNotification } from './sessionService.js'

/** RawEntry is untyped JSON; build entries through one cast so tests stay readable. */
function entry(value: Record<string, unknown>): RawEntry {
  return value as unknown as RawEntry
}

function assistant(output: number, content: unknown = [], reasoning?: number): RawEntry {
  return entry({
    type: 'assistant',
    message: {
      role: 'assistant',
      content,
      usage: {
        input_tokens: 10,
        output_tokens: output,
        ...(reasoning !== undefined ? { reasoning_tokens: reasoning } : {}),
      },
    },
  })
}

const thinking = (text: string) => [{ type: 'thinking', thinking: text }]
/**
 * One record of a response that was streamed in several records — the shape the
 * CLI actually writes: the thinking block lands as its own assistant record with
 * no usage of its own, and the response's usage (reasoning included) lands on the
 * text record sharing its id. Measured on the local engine, both records carry
 * `output_tokens: 0, no reasoning` and `output_tokens: N, reasoning: R`.
 */
function assistantOfResponse(
  id: string,
  output: number,
  content: unknown = [],
  reasoning?: number,
): RawEntry {
  return entry({
    type: 'assistant',
    message: {
      id,
      role: 'assistant',
      content,
      usage: {
        input_tokens: 10,
        output_tokens: output,
        ...(reasoning !== undefined ? { reasoning_tokens: reasoning } : {}),
      },
    },
  })
}
const toolUse = [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }]

describe('computeSubagentUsage', () => {
  it('sums output across turns and estimates thinking from the thinking blocks', () => {
    // 40 CJK chars of thinking ≈ 10 tokens at the estimator's 4-chars-per-token.
    const usage = computeSubagentUsage([
      assistant(100, thinking('思'.repeat(40))),
      assistant(50, [{ type: 'text', text: 'done' }]),
      entry({ type: 'user', message: { role: 'user', content: 'x' } }),
    ])
    expect(usage?.outputTokens).toBe(150)
    expect(usage?.totalTokens).toBe(150)
    expect(usage?.thinkTokens).toBeGreaterThan(0)
  })

  it('prefers an engine-reported reasoning count over the estimate', () => {
    const usage = computeSubagentUsage([assistant(100, thinking('思'.repeat(400)), 33)])
    // The engine's 33 wins; estimating the same content would read ~100.
    expect(usage?.thinkTokens).toBe(33)
  })

  it('treats a reported reasoning_tokens of 0 as "not measured" and estimates anyway', () => {
    // Engines that fill the field without computing it report 0. Trusting that
    // zero suppressed the estimate and hid the split entirely.
    const usage = computeSubagentUsage([assistant(100, thinking('思'.repeat(40)), 0)])
    expect(usage?.thinkTokens).toBeGreaterThan(0)
  })

  it('omits thinkTokens when no turn produced thinking', () => {
    const usage = computeSubagentUsage([assistant(100, [{ type: 'text', text: 'hi' }])])
    expect(usage?.thinkTokens).toBeUndefined()
    expect(usage?.outputTokens).toBe(100)
  })

  it('counts tool uses from the assistant turns', () => {
    expect(computeSubagentUsage([assistant(10, toolUse), assistant(10, toolUse)])?.toolUses).toBe(2)
  })

  it('returns undefined when no turn reported output', () => {
    expect(computeSubagentUsage([])).toBeUndefined()
    expect(computeSubagentUsage([assistant(0)])).toBeUndefined()
    expect(computeSubagentUsage([entry({ type: 'user', message: { role: 'user' } })])).toBeUndefined()
  })
  it('does not estimate the thinking of a record whose response reported it', () => {
    // Measured shape (agent-a47f5e65272e0bd40.jsonl): the thinking record carries
    // output_tokens 0 and no reasoning; its sibling reports the real pair.
    // Estimating the first on top of the second made a 9.3k run report 15.7k of
    // thinking, which drove the UI's `total - think` to zero.
    const usage = computeSubagentUsage([
      assistantOfResponse('msg_1', 0, thinking('思'.repeat(400))),
      assistantOfResponse('msg_1', 100, [{ type: 'text', text: 'done' }], 60),
    ])
    expect(usage?.outputTokens).toBe(100)
    expect(usage?.thinkTokens).toBe(60)
    expect((usage?.totalTokens ?? 0) - (usage?.thinkTokens ?? 0)).toBe(40)
  })

  it('still estimates when no record of the response reported reasoning', () => {
    // Same split shape on an engine without the split: the estimate is the only
    // signal there is, and it must survive.
    const usage = computeSubagentUsage([
      assistantOfResponse('msg_2', 0, thinking('思'.repeat(40))),
      assistantOfResponse('msg_2', 100, [{ type: 'text', text: 'done' }]),
    ])
    expect(usage?.outputTokens).toBe(100)
    expect(usage?.thinkTokens).toBe(10)
  })
})

describe('attachUsageToNotifications', () => {
  const derived = new Map<string, SubagentUsage>([
    ['tool-1', { totalTokens: 900, outputTokens: 900, thinkTokens: 400, toolUses: 3 }],
  ])
  const notification = (toolUseId: string, usage?: SessionTaskNotification['usage']): SessionTaskNotification => ({
    taskId: `task-${toolUseId}`,
    toolUseId,
    status: 'completed',
    ...(usage ? { usage } : {}),
  })

  it('attaches the derived split when thinking is withheld', () => {
    const [result] = attachUsageToNotifications([notification('tool-1')], derived, true)
    expect(result?.usage).toEqual({ totalTokens: 900, outputTokens: 900, thinkTokens: 400, toolUses: 3 })
  })

  it('leaves thinkTokens off when thinking is sent back to the API', () => {
    // The live path withholds the split in that case; a reader must not get one
    // just because the number happened to be derived from disk.
    const [result] = attachUsageToNotifications([notification('tool-1')], derived, false)
    expect(result?.usage).toEqual({ totalTokens: 900, outputTokens: 900, toolUses: 3 })
    expect(result?.usage?.thinkTokens).toBeUndefined()
  })

  it('never overwrites a usage the live run already reported', () => {
    const live = { totalTokens: 5, outputTokens: 5, thinkTokens: 1 }
    const [result] = attachUsageToNotifications([notification('tool-1', live)], derived, true)
    expect(result?.usage).toEqual(live)
  })

  it('leaves notifications with no resolvable transcript untouched', () => {
    const [result] = attachUsageToNotifications([notification('tool-unknown')], derived, true)
    expect(result?.usage).toBeUndefined()
  })
})

describe('SessionUsageRollup', () => {
  function source(overrides: Partial<UsageRollupSource> & { sidecars?: unknown } = {}): {
    source: UsageRollupSource
    calls: { signature: number; sidecars: number; reads: number }
  } {
    const calls = { signature: 0, sidecars: 0, reads: 0 }
    const defaults: UsageRollupSource = {
      async getSessionMessagesSignature() {
        calls.signature += 1
        return 'sig-1'
      },
      async listSubagentSidecars() {
        calls.sidecars += 1
        return {
          sidecars: [
            { agentId: 'a1', toolUseId: 'tool-1' },
            { agentId: 'a2', toolUseId: 'tool-2', ownerAgentId: 'parent' },
          ],
          complete: true,
        }
      },
      async readSubagentTranscriptEntries(_sessionId, agentId) {
        calls.reads += 1
        return agentId === 'a1' ? [assistant(120, thinking('思'.repeat(20)))] : [assistant(7)]
      },
    }
    return { source: { ...defaults, ...(overrides as UsageRollupSource) }, calls }
  }

  it('keys root agents by toolUseId and skips owned sidecars', async () => {
    const { source: src } = source()
    const rollup = new SessionUsageRollup(src)
    const result = await rollup.byToolUseId('session-1')
    expect([...result.keys()]).toEqual(['tool-1'])
    expect(result.get('tool-1')?.outputTokens).toBe(120)
  })

  it('re-reads transcripts only when the signature moves', async () => {
    let signature = 'sig-1'
    const { source: src, calls } = source({
      async getSessionMessagesSignature() {
        calls.signature += 1
        return signature
      },
    })
    const rollup = new SessionUsageRollup(src)
    await rollup.byToolUseId('session-1')
    await rollup.byToolUseId('session-1')
    expect(calls.reads).toBe(1)

    // A running agent rewrites its transcript, which moves the signature.
    signature = 'sig-2'
    await rollup.byToolUseId('session-1')
    expect(calls.reads).toBe(2)
  })

  it('yields nothing rather than throwing when the session or sidecars are unreadable', async () => {
    const rollup = new SessionUsageRollup({
      async getSessionMessagesSignature() { return null },
      async listSubagentSidecars() { throw new Error('gone') },
      async readSubagentTranscriptEntries() { throw new Error('gone') },
    })
    expect((await rollup.byToolUseId('missing')).size).toBe(0)
  })

  it('keeps the other agents when one transcript cannot be read', async () => {
    const rollup = new SessionUsageRollup({
      async getSessionMessagesSignature() { return 'sig' },
      async listSubagentSidecars() {
        return {
          sidecars: [
            { agentId: 'bad', toolUseId: 'tool-bad' },
            { agentId: 'good', toolUseId: 'tool-good' },
          ],
          complete: false,
        }
      },
      async readSubagentTranscriptEntries(_sessionId, agentId) {
        if (agentId === 'bad') throw new Error('unreadable')
        return [assistant(42)]
      },
    })
    const result = await rollup.byToolUseId('session-1')
    expect([...result.keys()]).toEqual(['tool-good'])
  })
})
