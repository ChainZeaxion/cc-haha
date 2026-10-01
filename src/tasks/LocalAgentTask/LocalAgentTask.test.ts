import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  resetStateForTests,
  setIsInteractive,
  setSdkAgentProgressSummariesEnabled,
  switchSession,
} from '../../bootstrap/state.js'
import type { AppState } from '../../state/AppState.js'
import { IDLE_SPECULATION_STATE } from '../../state/AppStateStore.js'
import { createTaskStateBase } from '../../Task.js'
import type { CustomAgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import type { SessionId } from '../../types/ids.js'
import {
  dequeue,
  getCommandQueue,
  resetCommandQueue,
} from '../../utils/messageQueueManager.js'
import { drainSdkEvents } from '../../utils/sdkEventQueue.js'
import { _clearOutputsForTest } from '../../utils/task/diskOutput.js'
import {
  backgroundAgentTask,
  createProgressTracker,
  enqueueAgentNotification,
  getReasoningTokenCountFromTracker,
  getTokenCountFromTracker,
  type LocalAgentTaskState,
  registerAgentForeground,
  registerAsyncAgent,
  updateAgentSummary,
  updateProgressFromMessage,
} from './LocalAgentTask.js'

const selectedAgent = {
  agentType: 'general-purpose',
  whenToUse: 'Test task registration',
  rawSystemPrompt: 'Inspect ownership',
  getSystemPrompt: () => 'Inspect ownership',
  source: 'projectSettings',
} satisfies CustomAgentDefinition

function makeHarness(ownerAgentId?: string) {
  const taskId = ownerAgentId ? 'nested-agent' : 'root-agent'
  const task: LocalAgentTaskState = {
    ...createTaskStateBase(taskId, 'local_agent', 'Inspect ownership', 'toolu_agent'),
    type: 'local_agent',
    status: 'running',
    ownerAgentId,
    agentId: taskId,
    prompt: 'Inspect ownership',
    agentType: 'general-purpose',
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: true,
    pendingMessages: [],
    retain: false,
    diskLoaded: false,
  }
  let state = {
    tasks: { [taskId]: task },
    speculation: IDLE_SPECULATION_STATE,
  } as unknown as AppState
  return {
    taskId,
    get state() {
      return state
    },
    setAppState(updater: (prev: AppState) => AppState) {
      state = updater(state)
    },
  }
}

function makeEmptyHarness() {
  let state = {
    tasks: {},
    speculation: IDLE_SPECULATION_STATE,
  } as unknown as AppState
  return {
    get state() {
      return state
    },
    setAppState(updater: (prev: AppState) => AppState) {
      state = updater(state)
    },
  }
}

beforeEach(() => {
  resetStateForTests()
  resetCommandQueue()
  setIsInteractive(false)
  switchSession('local-agent-owner-test' as SessionId)
  drainSdkEvents()
})

afterEach(async () => {
  await _clearOutputsForTest()
  setSdkAgentProgressSummariesEnabled(false)
  drainSdkEvents()
  resetCommandQueue()
  resetStateForTests()
})

describe('enqueueAgentNotification thinking split', () => {
  // The numbers are emitted only while the thinking itself is withheld: with
  // the reasoning visible, one total reads fine; with it hidden, the pair is the
  // only evidence that most of the cost was deliberation.
  test('emits think_tokens alongside the output when thinking is not returned', () => {
    const harness = makeHarness()

    enqueueAgentNotification({
      taskId: harness.taskId,
      description: 'Write an article',
      status: 'completed',
      setAppState: harness.setAppState,
      toolUseId: 'toolu_agent',
      usage: {
        totalTokens: 11_900,
        toolUses: 1,
        durationMs: 60_000,
        outputTokens: 11_900,
        reasoningTokens: 9_000,
      },
    })

    const value = String(getCommandQueue()[0]?.value)
    expect(value).toContain('<think_tokens>9000</think_tokens>')
    expect(value).toContain('<output_tokens>11900</output_tokens>')
    // The pre-existing total stays, so readers that only know it keep working.
    expect(value).toContain('<total_tokens>11900</total_tokens>')
  })

  test('omits the split when the run reported no reasoning share', () => {
    const harness = makeHarness()

    enqueueAgentNotification({
      taskId: harness.taskId,
      description: 'Run a command',
      status: 'completed',
      setAppState: harness.setAppState,
      toolUseId: 'toolu_agent',
      usage: { totalTokens: 2000, toolUses: 1, durationMs: 1000 },
    })

    const value = String(getCommandQueue()[0]?.value)
    expect(value).toContain('<total_tokens>2000</total_tokens>')
    expect(value).not.toContain('think_tokens')
  })
})

describe('enqueueAgentNotification ownership', () => {
  test('keeps a root agent terminal notification on the main-thread path', () => {
    const harness = makeHarness()

    enqueueAgentNotification({
      taskId: harness.taskId,
      description: 'Inspect ownership',
      status: 'completed',
      setAppState: harness.setAppState,
      toolUseId: 'toolu_agent',
    })

    expect(getCommandQueue()).toHaveLength(1)
    expect(getCommandQueue()[0]?.agentId).toBeUndefined()
    expect(drainSdkEvents()).toEqual([])
  })

  test('routes a nested terminal to its parent and emits owned SDK metadata', () => {
    const harness = makeHarness('parent-agent')

    enqueueAgentNotification({
      taskId: harness.taskId,
      description: 'Inspect ownership',
      status: 'completed',
      setAppState: harness.setAppState,
      toolUseId: 'toolu_agent',
      finalMessage: 'Ownership verified',
    })

    expect(getCommandQueue()).toHaveLength(1)
    expect(getCommandQueue()[0]?.agentId).toBe('parent-agent')
    expect(String(getCommandQueue()[0]?.value)).toContain(
      '<result>Ownership verified</result>',
    )
    expect(drainSdkEvents()).toEqual([
      expect.objectContaining({
        subtype: 'task_notification',
        task_id: 'nested-agent',
        tool_use_id: 'toolu_agent',
        status: 'completed',
        owner_agent_id: 'parent-agent',
      }),
    ])
    expect(
      dequeue((command) => command.agentId === 'parent-agent')?.agentId,
    ).toBe('parent-agent')
    expect(getCommandQueue()).toEqual([])
  })

  test('keeps summary progress scoped to the nested agent owner', () => {
    const harness = makeHarness('parent-agent')
    setSdkAgentProgressSummariesEnabled(true)

    updateAgentSummary(
      harness.taskId,
      'Checked provider ownership',
      harness.setAppState,
    )

    expect(
      (harness.state.tasks[harness.taskId] as LocalAgentTaskState).progress
        ?.summary,
    ).toBe('Checked provider ownership')
    expect(drainSdkEvents()).toEqual([
      expect.objectContaining({
        subtype: 'task_progress',
        task_id: 'nested-agent',
        summary: 'Checked provider ownership',
        owner_agent_id: 'parent-agent',
      }),
    ])
  })
})

describe('Agent task registration ownership', () => {
  test('persists the immediate owner for async and foreground registrations', async () => {
    const harness = makeEmptyHarness()
    const asyncTask = registerAsyncAgent({
      agentId: 'async-owned-agent',
      description: 'Async owned task',
      prompt: 'Inspect async ownership',
      selectedAgent,
      setAppState: harness.setAppState,
      toolUseId: 'toolu_async_owned',
      ownerAgentId: 'parent-agent-run',
    })

    expect(asyncTask.ownerAgentId).toBe('parent-agent-run')
    expect(
      (harness.state.tasks['async-owned-agent'] as LocalAgentTaskState)
        .ownerAgentId,
    ).toBe('parent-agent-run')
    asyncTask.unregisterCleanup?.()

    const foreground = registerAgentForeground({
      agentId: 'foreground-owned-agent',
      description: 'Foreground owned task',
      prompt: 'Inspect foreground ownership',
      selectedAgent,
      setAppState: harness.setAppState,
      toolUseId: 'toolu_foreground_owned',
      ownerAgentId: 'parent-agent-run',
    })
    const foregroundTask = harness.state.tasks[
      'foreground-owned-agent'
    ] as LocalAgentTaskState

    expect(foregroundTask.ownerAgentId).toBe('parent-agent-run')
    foregroundTask.unregisterCleanup?.()
    expect(
      backgroundAgentTask(
        foreground.taskId,
        () => harness.state,
        harness.setAppState,
      ),
    ).toBe(true)
    await foreground.backgroundSignal
  })
})


describe('getTokenCountFromTracker usage basis', () => {
  // The tracker sees both sides, but a run's "usage" means what it generated.
  // The input side is the window it was handed, so adding it made a run that
  // read a lot look busier than one that wrote a lot. The synchronous path was
  // moved onto this same basis so a run's number means one thing.
  test('reports generated output tokens, not the context it read', () => {
    const tracker = createProgressTracker()
    const turn = (input: number, cacheRead: number, output: number) => ({
      type: 'assistant' as const,
      message: {
        content: [],
        usage: {
          input_tokens: input,
          cache_read_input_tokens: cacheRead,
          cache_creation_input_tokens: 0,
          output_tokens: output,
        },
      },
    })

    updateProgressFromMessage(tracker, turn(1000, 5000, 300) as never)
    updateProgressFromMessage(tracker, turn(4000, 9000, 700) as never)

    expect(tracker.cumulativeOutputTokens).toBe(1000)
    // `latestInputTokens` is the latest turn's input, not a sum.
    expect(tracker.latestInputTokens).toBe(13000)
    expect(getTokenCountFromTracker(tracker)).toBe(1000)
  })
})

describe('thinking share of a run', () => {
  // On a reasoning model most of the output is deliberation, so a single total
  // cannot be read: 12k may be a 3k answer or a 3k answer plus 9k of thinking.
  test('prefers the engine count when it reports one', () => {
    const tracker = createProgressTracker()
    const turn = (output: number, reasoning?: number) => ({
      type: 'assistant' as const,
      message: {
        // Thinking content present, so an estimate would have a number to use —
        // the engine's own count must win anyway.
        content: [{ type: 'thinking', thinking: 'x'.repeat(4000) }],
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          output_tokens: output,
          ...(reasoning === undefined ? {} : { reasoning_tokens: reasoning }),
        },
      },
    })

    updateProgressFromMessage(tracker, turn(500, 300) as never)
    updateProgressFromMessage(tracker, turn(400, 150) as never)

    expect(tracker.cumulativeReasoningTokens).toBe(450)
    expect(getReasoningTokenCountFromTracker(tracker)).toBe(450)
  })

  test('estimates the thinking when the engine reports none', () => {
    const tracker = createProgressTracker()
    // 4000 chars of thinking at 4 bytes/token = 1000, used because no engine
    // count came with the turn — otherwise this endpoint would have no split.
    updateProgressFromMessage(tracker, {
      type: 'assistant' as const,
      message: {
        content: [{ type: 'thinking', thinking: 'x'.repeat(4000) }],
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          output_tokens: 1200,
        },
      },
    } as never)

    expect(tracker.cumulativeReasoningTokens).toBe(1000)
  })

  test('does not estimate a thinking record whose response reported the count', () => {
    // Measured shape on the local engine (agent-a47f5e65272e0bd40.jsonl): one
    // response arrives as two records sharing a message id — the thinking block
    // alone with `output_tokens: 0` and no reasoning, then the text record with
    // the real pair. Estimating the first on top of the second made a 9.3k run
    // report 15.7k of thinking, so the UI's `total - think` read zero.
    const tracker = createProgressTracker()
    const record = (output: number, content: unknown, reasoning?: number) => ({
      type: 'assistant' as const,
      message: {
        id: 'msg_1',
        content,
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          output_tokens: output,
          ...(reasoning === undefined ? {} : { reasoning_tokens: reasoning }),
        },
      },
    })

    updateProgressFromMessage(
      tracker,
      record(0, [{ type: 'thinking', thinking: 'x'.repeat(4000) }]) as never,
    )
    updateProgressFromMessage(
      tracker,
      record(1200, [{ type: 'text', text: 'done' }], 800) as never,
    )

    // The withdrawn estimate leaves the engine's own count alone.
    expect(tracker.cumulativeReasoningTokens).toBe(800)
    expect(tracker.cumulativeOutputTokens).toBe(1200)
    // And the non-thinking part stays positive, which is what the bar shows.
    expect(tracker.cumulativeOutputTokens - tracker.cumulativeReasoningTokens).toBe(400)
  })

  test('reports no thinking share for a run that did not think', () => {
    const tracker = createProgressTracker()
    updateProgressFromMessage(tracker, {
      type: 'assistant' as const,
      message: {
        content: [{ type: 'text', text: 'answer' }],
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          output_tokens: 40,
        },
      },
    } as never)

    // Absent rather than 0: a reader must be able to tell "no thinking" from
    // "the number is there and it is zero".
    expect(getReasoningTokenCountFromTracker(tracker)).toBeUndefined()
  })
})
