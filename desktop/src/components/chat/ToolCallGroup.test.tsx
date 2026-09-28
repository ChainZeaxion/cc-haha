import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToolCallGroup } from './ToolCallGroup'
import { useSettingsStore } from '../../stores/settingsStore'
import type { AgentTaskNotification, UIMessage } from '../../types/chat'

// 会话扩展信息在本 fork 默认开启；用例若关闭后必须复位，避免泄漏到后续用例。
// cleanup 先卸载，否则仍在挂载的组件会订阅到这里的 setState（act 警告）。
afterEach(() => {
  cleanup()
  useSettingsStore.setState({ sessionExtendedInfo: true })
})

type ToolCall = Extract<UIMessage, { type: 'tool_use' }>
type ToolResult = Extract<UIMessage, { type: 'tool_result' }>

function agentCall(id: string, timestamp: number): ToolCall {
  return {
    id: `tool-${id}`,
    type: 'tool_use',
    toolName: 'Agent',
    toolUseId: id,
    input: { description: `Review ${id}` },
    timestamp,
  }
}

function result(id: string, timestamp: number): ToolResult {
  return {
    id: `result-${id}`,
    type: 'tool_result',
    toolUseId: id,
    content: 'done',
    isError: false,
    timestamp,
  }
}

function renderGroup(
  toolCalls: ToolCall[],
  results: ToolResult[],
  notifications: Record<string, AgentTaskNotification> = {},
  liveUsage: Record<string, { totalTokens?: number; thinkTokens?: number }> = {},
) {
  return render(
    <ToolCallGroup
      sessionId="session-1"
      toolCalls={toolCalls}
      resultMap={new Map(results.map((item) => [item.toolUseId, item]))}
      childToolCallsByParent={new Map()}
      agentTaskNotifications={notifications}
      agentTaskLiveUsage={liveUsage}
    />,
  )
}

function rowDurations(): (string | null | undefined)[] {
  return Array.from(document.querySelectorAll('[data-agent-call-duration="true"]'))
    .map((node) => node.textContent?.trim())
}

describe('subagent run duration', () => {
  it('sums the members into the header and shows each run beside its own actions', () => {
    // Two synchronous agents, each blocking its own tool call: 120s and 300s.
    const toolCalls = [agentCall('a', 1_000), agentCall('b', 200_000)]
    const results = [result('a', 121_000), result('b', 500_000)]
    renderGroup(toolCalls, results)

    // Header is the group's wall-clock SPAN, not the sum: the runs start 199s
    // apart and the last ends at 500s, so it reads 8m19s — a serial sum would
    // have said 2m0s + 5m0s = 7m0s.
    const header = screen.getByRole('button', { name: /dispatched 2 agents/i })
    const headerDuration = document.querySelector('[data-agent-group-duration="true"]')
    expect(headerDuration?.textContent?.trim()).toBe('8m19s')
    expect(header.textContent).toContain('Duration')
    expect(header.textContent).not.toContain('7m0s')
    // Rows only mount once the group is expanded, and each stays bare.
    expect(rowDurations()).toEqual([])
    fireEvent.click(header)
    expect(rowDurations()).toEqual(['2m0s', '5m0s'])
  })

  it('prefers the runtime report for a background agent, whose call returns at launch', () => {
    // The launch result lands 50ms after the call, but the run itself took
    // three minutes — only the report knows that.
    const toolCalls = [agentCall('bg', 1_000)]
    const results = [result('bg', 1_050)]
    const notifications: Record<string, AgentTaskNotification> = {
      bg: {
        taskId: 'task-bg',
        toolUseId: 'bg',
        status: 'completed',
        usage: { durationMs: 180_000 },
      },
    }
    renderGroup(toolCalls, results, notifications)

    expect(document.querySelector('[data-agent-group-duration="true"]')?.textContent?.trim()).toBe('3m0s')
    fireEvent.click(screen.getByRole('button', { name: /agent/i }))
    expect(rowDurations()).toEqual(['3m0s'])
  })

  it('shows an estimate for the elapsed time while a synchronous run is in flight', () => {
    // Waiting on a dispatch means watching elapsed time, so the header reports
    // it from the moment the call starts rather than staying blank until the
    // whole group ends. It is marked ≈ because the span is still open.
    renderGroup([agentCall('a', Date.now() - 30_000)], [])

    const headerDuration = document.querySelector('[data-agent-group-duration="true"]')
    expect(headerDuration?.textContent).toContain('≈')
    expect(headerDuration?.textContent).toMatch(/30s|31s/)

    const header = screen.getByRole('button', { name: /agent/i })
    fireEvent.click(header)
    // Rows keep reporting settled numbers only; the summary is what ticks.
    expect(rowDurations()).toEqual([])
  })

  it('omits the elapsed estimate when the call has no usable start', () => {
    // An absent timestamp defaults to 0, and closing that at "now" would print a
    // span measured from 1970.
    renderGroup([agentCall('a', 0)], [])
    expect(document.querySelector('[data-agent-group-duration="true"]')).toBeNull()
  })
})

describe('a parallel dispatch is spanned, never summed', () => {
  it('reports one run\'s length when the agents start together', () => {
    // Both dispatched at the same instant, each taking two minutes. Summing
    // would print 4m of work for 2m of wall clock.
    const toolCalls = [agentCall('a', 1_000), agentCall('b', 1_000)]
    const results = [result('a', 121_000), result('b', 121_000)]
    renderGroup(toolCalls, results)

    const headerDuration = document.querySelector('[data-agent-group-duration="true"]')
    expect(headerDuration?.textContent?.trim()).toBe('2m0s')
  })
})

describe('subagent group usage', () => {
  const withUsage = (id: string, timestamp: number, totalTokens: number): ToolResult => ({
    id: `result-${id}`,
    type: 'tool_result',
    toolUseId: id,
    content: `agentId: ${id} (use SendMessage with to: '${id}')\n<usage>total_tokens: ${totalTokens}\ntool_uses: 3\nduration_ms: 1000</usage>`,
    isError: false,
    timestamp,
  })

  it('adds the members up in the header — work is not shared the way the wall clock is', () => {
    // Two concurrent runs of 10k and 20k: 30k of work, unlike the span, which
    // would count the overlap once.
    const toolCalls = [agentCall('a', 1_000), agentCall('b', 1_000)]
    renderGroup(toolCalls, [withUsage('a', 61_000, 10_000), withUsage('b', 61_000, 20_000)])

    const usage = document.querySelector('[data-agent-group-usage="true"]')
    expect(usage?.textContent?.trim()).toBe('30.00k')
  })

  it('omits the number rather than showing zero when nothing reported tokens', () => {
    renderGroup([agentCall('a', 1_000)], [result('a', 61_000)])
    expect(document.querySelector('[data-agent-group-usage="true"]')).toBeNull()
  })

  it('keeps tokens off the individual rows, where only the duration belongs', () => {
    const toolCalls = [agentCall('a', 1_000), agentCall('b', 1_000)]
    renderGroup(toolCalls, [withUsage('a', 61_000, 10_000), withUsage('b', 61_000, 20_000)])
    fireEvent.click(screen.getByRole('button', { name: /dispatched 2 agents/i }))

    const rowText = document.querySelector('[data-agent-call-duration="true"]')?.parentElement?.textContent ?? ''
    expect(rowText).not.toContain('k')
  })

  it('splits into thinking + the rest when the runtime reported the reasoning share', () => {
    // The runtime emits the split only while the thinking itself is withheld, so
    // a present count is the case where the bar must show two numbers: without
    // it, a 30k run reads as 30k of answer when 22k of it was deliberation.
    const withSplit = (id: string, total: number, think: number): ToolResult => ({
      id: `result-${id}`,
      type: 'tool_result',
      toolUseId: id,
      content: `agentId: ${id} (use SendMessage with to: '${id}')\n<usage>total_tokens: ${total}\ntool_uses: 3\nduration_ms: 1000\noutput_tokens: ${total}\nthink_tokens: ${think}</usage>`,
      isError: false,
      timestamp: 61_000,
    })
    renderGroup([agentCall('a', 1_000)], [withSplit('a', 30_000, 22_000)])

    const usage = document.querySelector('[data-agent-group-usage="true"]')
    expect(usage?.textContent?.replace(/\s+/g, '')).toBe('22.00k+8.00k')
  })

  it('counts what a still-running run has produced so far', () => {
    // Waiting on a dispatch means watching the total climb. Before this, the
    // header had nothing to show until the last agent finished, so six agents
    // running for minutes reported nothing at all.
    renderGroup([agentCall('a', Date.now() - 1_000)], [], {}, { a: { totalTokens: 12_000 } })

    const usage = document.querySelector('[data-agent-group-usage="true"]')
    expect(usage?.textContent?.replace(/\s+/g, '')).toBe('≈12.00k')
  })

  it('shows the live split while a run is in flight', () => {
    // Same contract as a settled run: thinking is withheld from the API, so the
    // running numbers split too rather than showing one total.
    renderGroup(
      [agentCall('a', Date.now() - 1_000)],
      [],
      {},
      { a: { totalTokens: 30_000, thinkTokens: 22_000 } },
    )

    const usage = document.querySelector('[data-agent-group-usage="true"]')
    expect(usage?.textContent?.replace(/\s+/g, '')).toBe('≈22.00k+8.00k')
  })

  it('drops the live figures once the completion notification lands', () => {
    // The notification is authoritative and final. If the live entry lingered,
    // the bar would keep printing a snapshot taken mid-run instead of the run's
    // real total — the correction step in this design.
    renderGroup(
      [agentCall('a', 1_000)],
      [withUsage('a', 61_000, 40_000)],
      { a: { taskId: 'task-a', toolUseId: 'a', status: 'completed', usage: { totalTokens: 40_000, thinkTokens: 30_000 } } },
      {},
    )

    const usage = document.querySelector('[data-agent-group-usage="true"]')
    expect(usage?.textContent?.replace(/\s+/g, '')).toBe('30.00k+10.00k')
  })

  it('hides the header usage and duration when session extended info is off', () => {
    useSettingsStore.setState({ sessionExtendedInfo: false })
    const toolCalls = [agentCall('a', 1_000), agentCall('b', 1_000)]
    renderGroup(toolCalls, [withUsage('a', 61_000, 10_000), withUsage('b', 61_000, 20_000)])

    // 收纳栏头部的用量与耗时读数整体消失，但分组本身照常渲染。
    expect(document.querySelector('[data-agent-group-usage="true"]')).toBeNull()
    expect(document.querySelector('[data-agent-group-duration="true"]')).toBeNull()
    expect(screen.getByRole('button', { name: /dispatched 2 agents/i })).toBeTruthy()
  })
})
