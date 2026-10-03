import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  activeAgentTasks,
  activeBackgroundTaskIds,
  activeNonAgentTasks,
  activeSubagentRuns,
  getCliBackgroundTaskLifecycle,
} from './agentTaskState.js'

describe('getCliBackgroundTaskLifecycle ownership', () => {
  test('keeps root task ownership implicit', () => {
    expect(getCliBackgroundTaskLifecycle({
      type: 'system',
      subtype: 'task_started',
      task_id: 'root-agent',
      task_type: 'local_agent',
    })).toEqual({
      taskId: 'root-agent',
      running: true,
      taskType: 'local_agent',
      toolUseId: undefined,
      remoteSessionId: undefined,
      description: undefined,
      ownerAgentId: undefined,
    })
  })

  test('carries nested ownership from start through terminal lifecycle', () => {
    expect(getCliBackgroundTaskLifecycle({
      type: 'system',
      subtype: 'task_started',
      task_id: 'nested-agent',
      task_type: 'local_agent',
      owner_agent_id: 'parent-agent',
    })).toEqual(expect.objectContaining({
      taskId: 'nested-agent',
      running: true,
      ownerAgentId: 'parent-agent',
    }))

    expect(getCliBackgroundTaskLifecycle({
      type: 'system',
      subtype: 'task_notification',
      task_id: 'nested-agent',
      status: 'completed',
      owner_agent_id: 'parent-agent',
    })).toEqual({
      taskId: 'nested-agent',
      running: false,
      status: 'completed',
      ownerAgentId: 'parent-agent',
    })
  })
})

describe('activeSubagentRuns', () => {
  const SESSION = 'active-subagent-runs'

  beforeEach(() => {
    activeBackgroundTaskIds.clear()
    activeAgentTasks.clear()
    activeNonAgentTasks.clear()
  })
  afterEach(() => {
    activeBackgroundTaskIds.clear()
    activeAgentTasks.clear()
    activeNonAgentTasks.clear()
  })

  function agentTask(taskId: string, toolUseId: string): void {
    let ids = activeBackgroundTaskIds.get(SESSION)
    if (!ids) {
      ids = new Set()
      activeBackgroundTaskIds.set(SESSION, ids)
    }
    ids.add(taskId)
    let tasks = activeAgentTasks.get(SESSION)
    if (!tasks) {
      tasks = new Map()
      activeAgentTasks.set(SESSION, tasks)
    }
    tasks.set(taskId, {
      taskId,
      taskType: 'local_agent',
      toolUseId,
      stopIntent: false,
      stopRequested: false,
      localStopConfirmed: false,
      bookendPending: false,
      finalizationRetryCount: 0,
    })
  }

  test('reports the run id and the spawning tool-call id as a pair', () => {
    // The two differ in practice: the run id is the agent's own id, the tool-use
    // id is the Agent tool call's. A client that missed `task_started` needs both.
    agentTask('a74ce8', 'call_00_s8R2abcdef')
    expect(activeSubagentRuns(SESSION)).toEqual([
      { taskId: 'a74ce8', toolUseId: 'call_00_s8R2abcdef' },
    ])
  })

  test('excludes a shell job sharing the same active set', () => {
    agentTask('a74ce8', 'call_00_s8R2abcdef')
    // A Bash background task is active too, and has no subagent transcript — it
    // must not be looked up as if its usage were derivable.
    activeBackgroundTaskIds.get(SESSION)!.add('bash-1')
    expect(activeSubagentRuns(SESSION)).toEqual([
      { taskId: 'a74ce8', toolUseId: 'call_00_s8R2abcdef' },
    ])
  })

  test('is empty when nothing is running', () => {
    expect(activeSubagentRuns(SESSION)).toEqual([])
    expect(activeSubagentRuns('some-other-session')).toEqual([])
  })
})
