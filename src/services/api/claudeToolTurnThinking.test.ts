import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getIsInteractive, setIsInteractive } from '../../bootstrap/state.js'
import { enableConfigs } from '../../utils/config.js'
import {
  getToolTurnThinking,
  resetPromptLanguageCacheForTests,
  setToolTurnThinkingPreference,
  resolveToolTurnThinkingSetting,
} from '../../prompts/i18n/promptLanguage.js'
import { queryModelWithStreaming } from './claude.js'
import { createUserMessage } from '../../utils/messages.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'
import { getEmptyToolPermissionContext } from '../../Tool.js'

function textSSE(): string {
  return [
    'event: message_start\n',
    'data: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","model":"loopback-model","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":0}}}\n\n',
    'event: content_block_start\n',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    'event: content_block_delta\n',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"OK"}}\n\n',
    'event: content_block_stop\n',
    'data: {"type":"content_block_stop","index":0}\n\n',
    'event: message_delta\n',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}\n\n',
    'event: message_stop\n',
    'data: {"type":"message_stop"}\n\n',
  ].join('')
}

/**
 * Run one queryModelWithStreaming with a `fetchOverride` that captures the
 * serialized request body and answers with a minimal text SSE stream. No real
 * network is involved, so the loopback/public distinction is tested purely by
 * which ANTHROPIC_BASE_URL we point at.
 */
async function captureRequestBody(
  baseUrl: string,
  disableToolTurnThinking?: boolean,
): Promise<Record<string, unknown>> {
  const bodies: Array<Record<string, unknown>> = []
  const fetchOverride: typeof fetch = async (input, init) => {
    const raw = init?.body
    if (typeof raw === 'string') bodies.push(JSON.parse(raw))
    else if (raw instanceof Uint8Array) {
      bodies.push(JSON.parse(new TextDecoder().decode(raw)))
    }
    return new Response(textSSE(), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
  }

  const configDir = await mkdtemp(join(tmpdir(), 'cc-haha-tool-turn-thinking-'))
  const globals = globalThis as typeof globalThis & { MACRO?: { BUILD_TIME: string } }
  const originalMacro = globals.MACRO
  const originalIsInteractive = getIsInteractive()
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL
  const originalHome = process.env.HOME
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  const originalApiKey = process.env.ANTHROPIC_API_KEY

  try {
    globals.MACRO = { BUILD_TIME: '' }
    setIsInteractive(false)
    process.env.NODE_ENV = 'production'
    process.env.HOME = configDir
    process.env.CLAUDE_CONFIG_DIR = configDir
    process.env.ANTHROPIC_BASE_URL = baseUrl
    process.env.ANTHROPIC_API_KEY = 'loopback-test-key'
    delete process.env.CLAUDE_CODE_USE_BEDROCK
    delete process.env.CLAUDE_CODE_USE_VERTEX
    delete process.env.CLAUDE_CODE_USE_FOUNDRY
    enableConfigs()

    for await (const _ of queryModelWithStreaming({
      messages: [createUserMessage({ content: 'Hello' })],
      systemPrompt: asSystemPrompt(''),
      thinkingConfig: { type: 'disabled' },
      tools: [],
      signal: new AbortController().signal,
      options: {
        model: 'loopback-model',
        querySource: 'insights',
        agents: [],
        isNonInteractiveSession: true,
        hasAppendSystemPrompt: false,
        mcpTools: [],
        getToolPermissionContext: async () => getEmptyToolPermissionContext(),
        fetchOverride,
        ...(disableToolTurnThinking !== undefined && { disableToolTurnThinking }),
      },
    })) {
      // drain the stream
    }
    return bodies[0] ?? {}
  } finally {
    if (originalMacro === undefined) delete globals.MACRO
    else globals.MACRO = originalMacro
    setIsInteractive(originalIsInteractive)
    if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
    else process.env.ANTHROPIC_BASE_URL = originalBaseUrl
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalApiKey
    await rm(configDir, { recursive: true, force: true })
  }
}

describe('toolTurnThinking preference resolution', () => {
  test('resolveToolTurnThinkingSetting returns true only for the literal boolean', () => {
    expect(resolveToolTurnThinkingSetting(true)).toBe(true)
    expect(resolveToolTurnThinkingSetting(false)).toBe(false)
    expect(resolveToolTurnThinkingSetting('true')).toBe(false)
    expect(resolveToolTurnThinkingSetting(1)).toBe(false)
    expect(resolveToolTurnThinkingSetting(null)).toBe(false)
    expect(resolveToolTurnThinkingSetting(undefined)).toBe(false)
  })

  test('getToolTurnThinking defaults to false when no preference is stored', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'cc-haha-tool-turn-thinking-default-'))
    const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    const originalHome = process.env.HOME
    process.env.CLAUDE_CONFIG_DIR = configDir
    process.env.HOME = configDir
    resetPromptLanguageCacheForTests()
    try {
      expect(getToolTurnThinking()).toBe(false)
    } finally {
      if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
      else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
      if (originalHome === undefined) delete process.env.HOME
      else process.env.HOME = originalHome
      await rm(configDir, { recursive: true, force: true })
    }
  })

  test('getToolTurnThinking reads the stored true value from desktop-ui.json', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'cc-haha-tool-turn-thinking-stored-'))
    await mkdir(join(configDir, 'cc-haha'), { recursive: true })
    await writeFile(
      join(configDir, 'cc-haha', 'desktop-ui.json'),
      JSON.stringify({ toolTurnThinking: true }),
    )
    const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    const originalHome = process.env.HOME
    process.env.CLAUDE_CONFIG_DIR = configDir
    process.env.HOME = configDir
    resetPromptLanguageCacheForTests()
    try {
      expect(getToolTurnThinking()).toBe(true)
    } finally {
      if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
      else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
      if (originalHome === undefined) delete process.env.HOME
      else process.env.HOME = originalHome
      await rm(configDir, { recursive: true, force: true })
    }
  })

  test('setToolTurnThinkingPreference updates the in-process cache', () => {
    resetPromptLanguageCacheForTests()
    expect(setToolTurnThinkingPreference(true)).toBe(true)
    expect(getToolTurnThinking()).toBe(true)
    expect(setToolTurnThinkingPreference(false)).toBe(false)
    expect(getToolTurnThinking()).toBe(false)
  })
})

describe('chat_template_kwargs enable_thinking injection', () => {
  test('injects enable_thinking=false on a loopback engine when the flag is set', async () => {
    resetPromptLanguageCacheForTests()
    try {
      setToolTurnThinkingPreference(false)
      const body = await captureRequestBody('http://127.0.0.1:8000/v1', true)
      expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
    } finally {
      setToolTurnThinkingPreference(false)
    }
  }, 15_000)

  test('does not inject chat_template_kwargs when the flag is not set', async () => {
    resetPromptLanguageCacheForTests()
    try {
      setToolTurnThinkingPreference(false)
      const body = await captureRequestBody('http://127.0.0.1:8000/v1', undefined)
      expect(body.chat_template_kwargs).toBeUndefined()
    } finally {
      setToolTurnThinkingPreference(false)
    }
  }, 15_000)

  test('does not inject chat_template_kwargs on a public endpoint even when the flag is set', async () => {
    resetPromptLanguageCacheForTests()
    try {
      setToolTurnThinkingPreference(false)
      const body = await captureRequestBody('https://api.anthropic.com', true)
      expect(body.chat_template_kwargs).toBeUndefined()
    } finally {
      setToolTurnThinkingPreference(false)
    }
  }, 15_000)
})
