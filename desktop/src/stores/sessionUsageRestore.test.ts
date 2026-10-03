import { describe, expect, it } from 'vitest'
import {
  agentGroupThinkTokens,
  agentGroupTokens,
  agentRunThinkTokens,
  agentRunTokens,
  agentTokenParts,
} from '../components/chat/activityGroupModel'
import type { AgentTaskNotification } from '../types/chat'
import type { MessageEntry } from '../types/session'
import { reconstructRunActivityFromTranscript } from './chatStore'

const TOOL_USE_ID = 'call_subagent_1'

/**
 * A finished Agent call as an older transcript wrote it: the result text carries
 * only `total_tokens`, written with the agent's last context window (150k) —
 * not the tokens it generated. That single number is all a restored session used
 * to have, which is why the group bar could only ever show one total.
 */
function olderTranscript(): MessageEntry[] {
  return [
    {
      id: 'agent-use',
      type: 'assistant',
      timestamp: '2026-09-27T02:40:00.000Z',
      content: [{ type: 'tool_use', id: TOOL_USE_ID, name: 'Agent', input: { description: 'write' } }],
    },
    {
      id: 'agent-result',
      type: 'tool_result',
      timestamp: '2026-09-27T02:44:00.000Z',
      content: [{
        type: 'tool_result',
        tool_use_id: TOOL_USE_ID,
        content: 'done\n<usage>total_tokens: 150000\ntool_uses: 3\nduration_ms: 1000</usage>',
      }],
    },
  ] as unknown as MessageEntry[]
}

function notification(usage?: AgentTaskNotification['usage']): AgentTaskNotification {
  return {
    taskId: 'task-1',
    toolUseId: TOOL_USE_ID,
    status: 'completed',
    ...(usage ? { usage } : {}),
  }
}

/** How the group bar reads one Agent call. */
function barParts(notifications: Record<string, AgentTaskNotification>): string[] {
  const total = agentGroupTokens([agentRunTokens(notifications[TOOL_USE_ID]?.usage?.totalTokens, undefined)])
  const think = agentGroupThinkTokens([agentRunThinkTokens(notifications[TOOL_USE_ID]?.usage?.thinkTokens, undefined)])
  return agentTokenParts(total, think)
}

describe('restored session token split', () => {
  it('shows only the stale context total when nothing was derived', () => {
    // Baseline: the old behaviour this pilot exists to fix. The result text's
    // 150k is a context window, and there is no thinking share to show.
    const restored = reconstructRunActivityFromTranscript(olderTranscript())
    const entry = restored.agentTaskNotifications[TOOL_USE_ID]
    const withFallback = agentGroupTokens([
      agentRunTokens(entry?.usage?.totalTokens, {
        content: '<usage>total_tokens: 150000\ntool_uses: 3</usage>',
      } as never),
    ])
    expect(withFallback).toBe(150000)
    expect(agentTokenParts(withFallback, undefined)).toEqual(['150.00k'])
  })

  it('shows think + non-think once the server supplies the derived usage', () => {
    const restored = reconstructRunActivityFromTranscript(
      olderTranscript(),
      [notification({ totalTokens: 6554, outputTokens: 6554, thinkTokens: 4844, toolUses: 0 })],
    )

    // The bar reads agentTaskNotifications, so the derived usage has to survive
    // the merge with the notifications parsed out of the transcript itself.
    expect(restored.agentTaskNotifications[TOOL_USE_ID]?.usage?.thinkTokens).toBe(4844)
    expect(barParts(restored.agentTaskNotifications)).toEqual(['4.84k', '1.71k'])
  })

  it('keeps one total when the server withheld the thinking share', () => {
    // The split is withheld when thinking is sent back to the API; the reader
    // then shows the run's own total, matching the live path.
    const restored = reconstructRunActivityFromTranscript(
      olderTranscript(),
      [notification({ totalTokens: 6554, outputTokens: 6554, toolUses: 0 })],
    )
    expect(barParts(restored.agentTaskNotifications)).toEqual(['6.55k'])
  })
})
