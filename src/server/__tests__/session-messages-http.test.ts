/**
 * Route-level invariant: the HTTP surface never inlines linked subagent tool
 * messages.
 *
 * A real session merged its 44 linked subagent transcripts (527 MB of files)
 * into one 541,817,705-byte / 539,323,608-character response, past V8's
 * 536,870,888-character string limit — where Chromium silently turns the body
 * into an empty string and the app reports `Unexpected end of JSON input`.
 * The service still merges for its own consumers (rewind, teams, workspace),
 * so the only thing keeping the collapse away is the flag the two routes pass.
 * These tests fail if that flag is dropped.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { handleApiRequest } from '../router.js'
import { sessionService } from '../services/sessionService.js'
import { sessionUsageRollup } from '../services/sessionUsageRollup.js'
import { activeAgentTasks, activeBackgroundTaskIds } from '../ws/agentTaskState.js'
import { clearAgentRunUsage, observeAgentRunUsage } from '../services/agentRunUsageProjection.js'

const SUBAGENT_SENTINEL = 'SUBPAGENT_ONLY_SENTINEL_read_alpha'

let tmpDir: string
let previousConfig: string | undefined

async function api(method: string, pathname: string): Promise<Response> {
  const url = new URL(pathname, 'http://localhost:3456')
  return handleApiRequest(new Request(url.toString(), { method }), url)
}

async function writeJsonl(filePath: string, entries: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(
    filePath,
    entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
    'utf-8',
  )
}

async function seedSessionWithSubagent(): Promise<string> {
  const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const projectDir = '-tmp-http-invariant'
  const agentId = 'httpinvariant1'

  await writeJsonl(path.join(tmpDir, 'projects', projectDir, `${sessionId}.jsonl`), [
    {
      type: 'file-history-snapshot',
      messageId: crypto.randomUUID(),
      snapshot: { messageId: crypto.randomUUID(), trackedFileBackups: {}, timestamp: '2026-01-01T00:00:00.000Z' },
      isSnapshotUpdate: false,
    },
    {
      parentUuid: null,
      isSidechain: false,
      type: 'user',
      message: { role: 'user', content: 'Dispatch an agent' },
      uuid: crypto.randomUUID(),
      timestamp: '2026-01-01T00:01:00.000Z',
      userType: 'external',
      cwd: '/tmp/test',
      sessionId,
    },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'Agent:0', name: 'Agent', input: { description: 'Inspect alpha' } },
        ],
      },
      uuid: crypto.randomUUID(),
      timestamp: '2026-01-01T00:00:02.000Z',
    },
    {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'Agent:0',
            content: [
              {
                type: 'text',
                text: `alpha summary\nagentId: ${agentId} (use SendMessage with to: '${agentId}' to continue this agent)`,
              },
            ],
          },
        ],
      },
      uuid: crypto.randomUUID(),
      timestamp: '2026-01-01T00:00:03.000Z',
    },
  ])

  await writeJsonl(
    path.join(tmpDir, 'projects', projectDir, sessionId, 'subagents', `agent-${agentId}.jsonl`),
    [
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'Read:0', name: 'Read', input: { file_path: `/${SUBAGENT_SENTINEL}.txt` } },
          ],
        },
        uuid: crypto.randomUUID(),
        timestamp: '2026-01-01T00:00:04.000Z',
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'Read:0', content: SUBAGENT_SENTINEL },
          ],
        },
        uuid: crypto.randomUUID(),
        timestamp: '2026-01-01T00:00:05.000Z',
      },
    ],
  )

  return sessionId
}

beforeEach(async () => {
  previousConfig = process.env.CLAUDE_CONFIG_DIR
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-messages-http-'))
  process.env.CLAUDE_CONFIG_DIR = tmpDir
})

afterEach(async () => {
  if (previousConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = previousConfig
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('session messages HTTP surface', () => {
  it('keeps a transcript above 20 MiB readable when checkpoint previews exceed their budget (#1373)', async () => {
    const sessionId = await seedSessionWithSubagent()
    const filePath = path.join(tmpDir, 'projects', '-tmp-http-invariant', `${sessionId}.jsonl`)
    const content = 'x'.repeat(8 * 1024)
    const count = 2700
    await fs.appendFile(filePath, Array.from({ length: count }, (_, n) => JSON.stringify({
      type: 'assistant', uuid: `issue-1373-${n}`, timestamp: '2026-01-02T00:00:00Z',
      message: { role: 'assistant', content },
    })).join('\n') + '\n')
    expect((await fs.stat(filePath)).size).toBeGreaterThan(20 * 1024 * 1024)

    const checkpoint = await api('GET', `/api/sessions/${sessionId}/turn-checkpoints`)
    expect(checkpoint.status).toBe(413)
    expect((await checkpoint.json() as { error: string }).error).toBe('HISTORY_CHECKPOINT_PREVIEW_LIMIT')

    for (const suffix of ['', '/messages', '/messages?mode=full']) {
      const response = await api('GET', `/api/sessions/${sessionId}${suffix}`)
      expect(response.status).toBe(200)
      const body = await response.json() as {
        messages: Array<{ id: string; content: unknown }>
        page: { historyComplete: boolean; hasMore: boolean }
      }
      expect(body.messages.at(-1)?.id).toBe(`issue-1373-${count - 1}`)
      if (suffix.endsWith('mode=full')) {
        expect(body.messages.filter(message => message.id.startsWith('issue-1373-'))).toHaveLength(count)
        expect(body.page.historyComplete).toBe(true)
      } else {
        expect(body.page.hasMore).toBe(true)
      }
    }
  })

  it('bounds both public history endpoints and returns a continuation without canonical hydration', async () => {
    const sessionId = await seedSessionWithSubagent()
    const filePath = path.join(tmpDir, 'projects', '-tmp-http-invariant', `${sessionId}.jsonl`)
    const content = 'x'.repeat(256 * 1024)
    for (let n = 0; n < 20; n++) await fs.appendFile(filePath, JSON.stringify({ type: 'assistant', uuid: `large-${n}`, timestamp: '2026-01-02T00:00:00Z', message: { role: 'assistant', content } }) + '\n')
    const full = spyOn(sessionService, 'getSession').mockImplementation(() => { throw new Error('canonical hydration is forbidden on UI routes') })
    try {
      for (const suffix of ['/messages', '']) {
        const response = await api('GET', `/api/sessions/${sessionId}${suffix}`)
        expect(response.status).toBe(200)
        const raw = await response.text()
        expect(Buffer.byteLength(raw)).toBeLessThan(2 * 1024 * 1024)
        const body = JSON.parse(raw)
        expect(body.page.hasMore).toBe(true)
        expect(body.page.nextCursor).toBeString()
        expect(body.messages.at(-1).id).toBe('large-19')
      }
      expect(full).not.toHaveBeenCalled()
    } finally { full.mockRestore() }
  })

  it('rejects oversized automatic checkpoint previews before canonical history loading', async () => {
    const sessionId = await seedSessionWithSubagent()
    const filePath = path.join(tmpDir, 'projects', '-tmp-http-invariant', `${sessionId}.jsonl`)
    await fs.truncate(filePath, 17 * 1024 * 1024)
    const canonical = spyOn(sessionService, 'getSessionMessagesWithEvidence').mockImplementation(() => { throw new Error('full history must not be hydrated') })
    try {
      const response = await api('GET', `/api/sessions/${sessionId}/turn-checkpoints`)
      expect(response.status).toBe(413)
      expect((await response.json() as { error: string }).error).toBe('HISTORY_CHECKPOINT_PREVIEW_LIMIT')
      expect(canonical).not.toHaveBeenCalled()
    } finally { canonical.mockRestore() }
  })

  it('returns the whole bounded transcript in one response for mode=full', async () => {
    const sessionId = await seedSessionWithSubagent()
    const filePath = path.join(tmpDir, 'projects', '-tmp-http-invariant', `${sessionId}.jsonl`)
    const content = 'x'.repeat(16 * 1024)
    for (let n = 0; n < 60; n++) await fs.appendFile(filePath, JSON.stringify({ type: 'assistant', uuid: `full-${n}`, timestamp: '2026-01-02T00:00:00Z', message: { role: 'assistant', content } }) + '\n')
    const response = await api('GET', `/api/sessions/${sessionId}/messages?mode=full`)
    expect(response.status).toBe(200)
    const body = await response.json() as { messages: Array<{ id?: string }>; page: { historyComplete: boolean; nextCursor: string | null } }
    // Every appended record arrives without a cursor walk, oldest first.
    const ids = body.messages.map(message => message.id ?? '').filter(id => id.startsWith('full-'))
    expect(ids).toEqual(Array.from({ length: 60 }, (_, n) => `full-${n}`))
    expect(body.page.historyComplete).toBe(true)
    expect(body.page.nextCursor).toBeNull()
  })

  it('rejects an unknown history mode', async () => {
    const sessionId = await seedSessionWithSubagent()
    const response = await api('GET', `/api/sessions/${sessionId}/messages?mode=sideways`)
    expect(response.status).toBe(400)
  })

  it('returns messages and task notifications without a second transcript scan', async () => {
    const sessionId = await seedSessionWithSubagent()
    await fs.appendFile(path.join(tmpDir, 'projects', '-tmp-http-invariant', `${sessionId}.jsonl`),
      JSON.stringify({
        type: 'cc-haha-task-notification',
        taskNotification: { taskId: 'task-1', toolUseId: 'Agent:0', status: 'completed', summary: 'Done' },
        timestamp: '2026-01-01T00:02:00.000Z',
      }) + '\n')
    const separateNotifications = spyOn(sessionService, 'getSessionTaskNotifications')
    try {
      const response = await api('GET', `/api/sessions/${sessionId}/messages`)
      expect(response.status).toBe(200)
      const body = await response.json() as { messages: unknown[]; taskNotifications: unknown[] }
      expect(body.messages.length).toBeGreaterThan(0)
      expect(body.taskNotifications).toEqual([{
        taskId: 'task-1', toolUseId: 'Agent:0', status: 'completed', summary: 'Done',
        timestamp: '2026-01-01T00:02:00.000Z',
      }])
      expect(separateNotifications).not.toHaveBeenCalled()
    } finally {
      separateNotifications.mockRestore()
    }
  })

  it('never inlines linked subagent tool messages in /messages', async () => {
    const sessionId = await seedSessionWithSubagent()

    const response = await api('GET', `/api/sessions/${sessionId}/messages`)
    expect(response.status).toBe(200)

    const body = await response.json() as {
      messages: Array<{ parentToolUseId?: string }>
    }
    // The root Agent call is still there — only its child tool stream moved to
    // `/subagents/by-tool`. (Sidechain entries written into the root file
    // itself are not covered by this flag; they are part of root-size, not the
    // link-and-merge path this guards.)
    expect(body.messages.length).toBeGreaterThan(0)
    expect(JSON.stringify(body)).not.toContain(SUBAGENT_SENTINEL)
    expect(body.messages.some((message) => message.parentToolUseId === 'Agent:0')).toBe(false)
  })

  it('never inlines linked subagent tool messages in the session detail', async () => {
    const sessionId = await seedSessionWithSubagent()

    const response = await api('GET', `/api/sessions/${sessionId}`)
    expect(response.status).toBe(200)

    const body = await response.json() as {
      messages: Array<{ parentToolUseId?: string }>
    }
    expect(body.messages.length).toBeGreaterThan(0)
    expect(JSON.stringify(body)).not.toContain(SUBAGENT_SENTINEL)
    expect(body.messages.some((message) => message.parentToolUseId === 'Agent:0')).toBe(false)
  })
})

describe('GET /api/sessions/:id/messages — runningAgentUsage', () => {
  it('is empty when no subagent run is active, so no finished run is re-opened', async () => {
    const sessionId = await seedSessionWithSubagent()
    const response = await api('GET', `/api/sessions/${sessionId}/messages`)
    expect(response.status).toBe(200)
    const body = await response.json() as { runningAgentUsage?: Record<string, unknown> }
    expect(body.runningAgentUsage).toEqual({})
  })

  it('carries both ids of the in-flight runs, and their total when there is one', async () => {
    const sessionId = await seedSessionWithSubagent()
    // One run is live, another finished earlier in the same session. The run id
    // and the spawning tool-call id are distinct, as they are in practice.
    activeBackgroundTaskIds.set(sessionId, new Set(['a74ce8']))
    activeAgentTasks.set(sessionId, new Map([['a74ce8', {
      taskId: 'a74ce8',
      taskType: 'local_agent' as const,
      toolUseId: 'call_00_live',
      stopIntent: false,
      stopRequested: false,
      localStopConfirmed: false,
      bookendPending: false,
      finalizationRetryCount: 0,
    }]]))
    const rollup = spyOn(sessionUsageRollup, 'byToolUseId').mockImplementation(async () => new Map([
      ['call_00_live', { totalTokens: 4200, outputTokens: 4200, toolUses: 2 }],
      ['call_00_done', { totalTokens: 999, outputTokens: 999, toolUses: 1 }],
    ]))
    try {
      const response = await api('GET', `/api/sessions/${sessionId}/messages`)
      expect(response.status).toBe(200)
      const body = await response.json() as { runningAgentUsage?: Record<string, unknown> }
      // Keyed by tool-use id (what the UI reads under), carrying the run id
      // alongside it: a client that joined mid-run never saw `task_started` and
      // cannot relate the two on its own.
      expect(body.runningAgentUsage).toEqual({
        call_00_live: { taskId: 'a74ce8', toolUseId: 'call_00_live', totalTokens: 4200, toolUses: 2 },
      })
      // The finished run is left out even though its transcript has a total:
      // the client marks everything here as running.
      expect(body.runningAgentUsage?.['call_00_done']).toBeUndefined()
    } finally {
      rollup.mockRestore()
      activeBackgroundTaskIds.clear()
      activeAgentTasks.clear()
    }
  })

  it('reports a live run with no total yet, so a late client can still place it', async () => {
    const sessionId = await seedSessionWithSubagent()
    activeBackgroundTaskIds.set(sessionId, new Set(['a74ce8']))
    activeAgentTasks.set(sessionId, new Map([['a74ce8', {
      taskId: 'a74ce8',
      taskType: 'local_agent' as const,
      toolUseId: 'call_00_live',
      stopIntent: false,
      stopRequested: false,
      localStopConfirmed: false,
      bookendPending: false,
      finalizationRetryCount: 0,
    }]]))
    // No transcript total yet: the run is inside its first, long generation, which
    // is exactly when a client joining now would otherwise have nothing at all.
    const rollup = spyOn(sessionUsageRollup, 'byToolUseId').mockImplementation(async () => new Map())
    try {
      const response = await api('GET', `/api/sessions/${sessionId}/messages`)
      expect(response.status).toBe(200)
      const body = await response.json() as { runningAgentUsage?: Record<string, unknown> }
      expect(body.runningAgentUsage).toEqual({
        call_00_live: { taskId: 'a74ce8', toolUseId: 'call_00_live' },
      })
    } finally {
      rollup.mockRestore()
      activeBackgroundTaskIds.clear()
      activeAgentTasks.clear()
    }
  })
})

describe('GET /api/sessions/:id/messages — runningAgentUsage counts a live generation', () => {
  it('answers with the in-flight estimate when the run has not crossed a boundary yet', async () => {
    const sessionId = await seedSessionWithSubagent()
    activeBackgroundTaskIds.set(sessionId, new Set(['a74ce8']))
    activeAgentTasks.set(sessionId, new Map([['a74ce8', {
      taskId: 'a74ce8',
      taskType: 'local_agent' as const,
      toolUseId: 'call_00_live',
      stopIntent: false,
      stopRequested: false,
      localStopConfirmed: false,
      bookendPending: false,
      finalizationRetryCount: 0,
    }]]))
    // No transcript total: still inside the first generation. This is exactly the
    // window in which a joining client used to start from zero.
    const rollup = spyOn(sessionUsageRollup, 'byToolUseId').mockImplementation(async () => new Map())
    try {
      observeAgentRunUsage(sessionId, { type: 'system', subtype: 'task_started', task_id: 'a74ce8', tool_use_id: 'call_00_live' })
      observeAgentRunUsage(sessionId, {
        type: 'system', subtype: 'agent_run_message', run_agent_id: 'a74ce8',
        event_kind: 'message',
        message: { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'x'.repeat(400) } } },
      })

      const response = await api('GET', `/api/sessions/${sessionId}/messages`)
      expect(response.status).toBe(200)
      const body = await response.json() as { runningAgentUsage?: Record<string, unknown> }
      expect(body.runningAgentUsage).toEqual({
        call_00_live: { taskId: 'a74ce8', toolUseId: 'call_00_live', totalTokens: 100 },
      })
    } finally {
      rollup.mockRestore()
      activeBackgroundTaskIds.clear()
      activeAgentTasks.clear()
      clearAgentRunUsage(sessionId)
    }
  })
})
