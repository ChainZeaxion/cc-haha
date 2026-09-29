/**
 * Agent and background-task lifecycle state for the session WebSocket handler.
 *
 * Moved verbatim out of `handler.ts` as the first cut of that file. This slice was
 * chosen because it is provably closed: these functions read and write only the six
 * containers declared here and call nothing outside them, so relocating them cannot
 * change behavior. The functions that emit stop bookends stayed behind on purpose —
 * they reach into the broadcast layer and the socket registry, so moving them would
 * have required injecting dependencies rather than moving code.
 *
 * All six containers are per-session and released by `clearAgentRuntimeState`, which
 * `cleanupSessionRuntimeState` calls. `src/server/__tests__/sessionStateCleanup.test.ts`
 * follows that closure across this module boundary.
 *
 * The slice needs no imports: every helper it uses is declared inside it.
 */

export type AgentTaskType = 'local_agent' | 'remote_agent'

export type ActiveNonAgentTaskState = {
  taskId: string
  taskType?: string
  toolUseId: string
  description?: string
  ownerAgentId?: string
}

export type ActiveAgentTaskState = {
  taskId: string
  taskType: AgentTaskType
  toolUseId: string
  remoteSessionId?: string
  description?: string
  ownerAgentId?: string
  stopIntent: boolean
  stopRequested: boolean
  localStopConfirmed: boolean
  bookendPending: boolean
  finalizationRetryCount: number
  finalizationRetryTimer?: ReturnType<typeof setTimeout>
  finalization?: Promise<boolean>
  remoteArchive?: Promise<boolean>
  remoteArchiveError?: string
  stopFailureMessage?: string
}

export const activeBackgroundTaskIds = new Map<string, Set<string>>()

export const activeAgentTasks = new Map<string, Map<string, ActiveAgentTaskState>>()

export const activeNonAgentTasks = new Map<string, Map<string, ActiveNonAgentTaskState>>()

export const authoritativeStoppedTaskIds = new Map<string, Set<string>>()

export const agentStopRequestedSessions = new Set<string>()

export const runtimeExitStoppedSessions = new Set<string>()

export type CliBackgroundTaskLifecycle = {
  taskId: string
  running: boolean
  taskType?: string
  toolUseId?: string
  remoteSessionId?: string
  description?: string
  ownerAgentId?: string
  status?: string
  suppressForward?: boolean
}

export function getCliBackgroundTaskLifecycle(cliMsg: any): CliBackgroundTaskLifecycle | null {
  if (cliMsg?.type !== 'system') return null
  const taskId = typeof cliMsg.task_id === 'string' ? cliMsg.task_id.trim() : ''
  if (!taskId) return null
  const optionalString = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined
  const taskType = typeof cliMsg.task_type === 'string' && cliMsg.task_type.trim()
    ? cliMsg.task_type.trim()
    : undefined
  const toolUseId = optionalString(cliMsg.tool_use_id)
  const remoteSessionId = optionalString(cliMsg.remote_session_id)
  const description = optionalString(cliMsg.description) ??
    optionalString(cliMsg.message) ??
    optionalString(cliMsg.title)
  const ownerAgentId = optionalString(cliMsg.owner_agent_id)

  if (cliMsg.subtype === 'task_started') {
    return { taskId, running: true, taskType, toolUseId, remoteSessionId, description, ownerAgentId }
  }

  if (cliMsg.subtype === 'task_notification' && cliMsg.status === 'running') {
    return { taskId, running: true, taskType, toolUseId, remoteSessionId, description, ownerAgentId }
  }

  if (
    cliMsg.subtype === 'task_notification' &&
    (cliMsg.status === 'completed' ||
      cliMsg.status === 'failed' ||
      cliMsg.status === 'stopped' ||
      cliMsg.status === 'killed')
  ) {
    return { taskId, running: false, status: cliMsg.status, ownerAgentId }
  }

  return null
}

export function isAgentTaskType(taskType: string | undefined): taskType is AgentTaskType {
  return taskType === 'local_agent' || taskType === 'remote_agent'
}

export function untrackCliBackgroundTask(sessionId: string, taskId: string): void {
  const taskIds = activeBackgroundTaskIds.get(sessionId)
  taskIds?.delete(taskId)
  if (taskIds?.size === 0) activeBackgroundTaskIds.delete(sessionId)

  const sessionAgentTasks = activeAgentTasks.get(sessionId)
  const agentTask = sessionAgentTasks?.get(taskId)
  if (agentTask?.finalizationRetryTimer !== undefined) {
    clearTimeout(agentTask.finalizationRetryTimer)
  }
  sessionAgentTasks?.delete(taskId)
  if (sessionAgentTasks?.size === 0) activeAgentTasks.delete(sessionId)

  const sessionNonAgentTasks = activeNonAgentTasks.get(sessionId)
  sessionNonAgentTasks?.delete(taskId)
  if (sessionNonAgentTasks?.size === 0) activeNonAgentTasks.delete(sessionId)
}

export function clearAgentRuntimeState(
  sessionId: string,
  options?: { preserveRetryableStops?: boolean },
): void {
  const retryableStops = options?.preserveRetryableStops
    ? new Map(
        [...(activeAgentTasks.get(sessionId)?.entries() ?? [])].filter(([, task]) =>
          task.stopIntent && task.localStopConfirmed && Boolean(task.stopFailureMessage),
        ),
      )
    : new Map<string, ActiveAgentTaskState>()

  for (const task of activeAgentTasks.get(sessionId)?.values() ?? []) {
    clearAgentStopFinalizationRetry(task)
  }
  activeBackgroundTaskIds.delete(sessionId)
  activeAgentTasks.delete(sessionId)
  activeNonAgentTasks.delete(sessionId)
  authoritativeStoppedTaskIds.delete(sessionId)
  agentStopRequestedSessions.delete(sessionId)
  runtimeExitStoppedSessions.delete(sessionId)

  if (retryableStops.size > 0) {
    activeAgentTasks.set(sessionId, retryableStops)
    activeBackgroundTaskIds.set(sessionId, new Set(retryableStops.keys()))
    agentStopRequestedSessions.add(sessionId)
  }
}

export function markTaskAuthoritativelyStopped(sessionId: string, taskId: string): void {
  let taskIds = authoritativeStoppedTaskIds.get(sessionId)
  if (!taskIds) {
    taskIds = new Set()
    authoritativeStoppedTaskIds.set(sessionId, taskIds)
  }
  taskIds.add(taskId)
}

export function hasActiveBackgroundTasks(sessionId: string): boolean {
  const taskIds = activeBackgroundTaskIds.get(sessionId)
  if (!taskIds || taskIds.size === 0) return false
  const sessionAgentTasks = activeAgentTasks.get(sessionId)
  return [...taskIds].some((taskId) => {
    const agentTask = sessionAgentTasks?.get(taskId)
    return !agentTask || !agentTask.localStopConfirmed || agentTask.bookendPending
  })
}

/** An in-flight subagent run, as the identity pair the rest of the system looks it up by. */
export type ActiveSubagentRun = {
  /** The run's own id. Live agent-run frames are addressed with this. */
  taskId: string
  /** The Agent tool call that spawned it. The UI and the usage rollup are keyed by this. */
  toolUseId: string
}

/**
 * The in-flight *subagent* runs of a session.
 *
 * Both ids are reported because they are not interchangeable and not derivable
 * from each other: `taskId` is what live frames carry, `toolUseId` is what the UI
 * renders the number under. A client that joined the session mid-run never saw the
 * `task_started` frame that ties the two together, so without both it cannot
 * present the run's usage at all — it would have to guess, and a guessed
 * `toolUseId` is simply never looked up.
 *
 * Agent tasks only on purpose. `activeBackgroundTaskIds` also holds shell jobs,
 * which have no subagent transcript and must not be looked up as if they had one.
 */
export function activeSubagentRuns(sessionId: string): ActiveSubagentRun[] {
  const taskIds = activeBackgroundTaskIds.get(sessionId)
  if (!taskIds || taskIds.size === 0) return []
  const sessionAgentTasks = activeAgentTasks.get(sessionId)
  const runs: ActiveSubagentRun[] = []
  for (const taskId of taskIds) {
    const agentTask = sessionAgentTasks?.get(taskId)
    if (!agentTask) continue
    runs.push({ taskId: agentTask.taskId, toolUseId: agentTask.toolUseId })
  }
  return runs
}

export function clearAgentStopFinalizationRetry(task: ActiveAgentTaskState): void {
  if (task.finalizationRetryTimer === undefined) return
  clearTimeout(task.finalizationRetryTimer)
  task.finalizationRetryTimer = undefined
}

export function markActiveAgentsStopping(sessionId: string): void {
  for (const task of activeAgentTasks.get(sessionId)?.values() ?? []) {
    task.stopIntent = true
    task.stopRequested = true
  }
}
