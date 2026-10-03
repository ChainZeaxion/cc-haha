import { describe, expect, test } from 'bun:test'
import { anthropicTokenTap } from './anthropicTokenTap.js'
import type { TokenChunkKind } from './openaiChatStreamToAnthropic.js'

function delta(deltaType: string, ids: number[], index = 0): string {
  return `event: content_block_delta\ndata: ${JSON.stringify({
    type: 'content_block_delta',
    index,
    delta: { type: deltaType },
    token_ids: ids,
  })}\n\n`
}

function source(input: string, bytewise = false): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(input)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytewise) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
      else controller.enqueue(bytes)
      controller.close()
    },
  })
}

async function run(input: string, options: { bytewise?: boolean; contentEncoding?: string } = {}) {
  const seen: { count: number; kind: TokenChunkKind }[] = []
  const out = await new Response(
    anthropicTokenTap(source(input, options.bytewise), {
      onTokenIds: (count, kind) => seen.push({ count, kind }),
      contentEncoding: options.contentEncoding,
    }),
  ).text()
  return { seen, out }
}

describe('anthropicTokenTap', () => {
  test('forwards the body byte-for-byte while counting ids by delta kind', async () => {
    const input =
      delta('thinking_delta', [1, 2]) +
      delta('text_delta', [3]) +
      delta('input_json_delta', [4, 5, 6])
    const { seen, out } = await run(input)
    expect(out).toBe(input)
    expect(seen).toEqual([
      { count: 2, kind: 'thinking' },
      { count: 1, kind: 'content' },
      { count: 3, kind: 'tool' },
    ])
  })

  test('reassembles events split across chunk boundaries', async () => {
    const input = delta('text_delta', [7, 8]) + delta('text_delta', [9])
    const { seen, out } = await run(input, { bytewise: true })
    expect(out).toBe(input)
    expect(seen).toEqual([
      { count: 2, kind: 'content' },
      { count: 1, kind: 'content' },
    ])
  })

  test('ignores events without ids, empty id arrays, and malformed payloads', async () => {
    const input =
      'event: message_start\ndata: {"type":"message_start"}\n\n' +
      'data: not json\n\n' +
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta"},"token_ids":[]}\n\n' +
      'data: [DONE]\n\n'
    const { seen, out } = await run(input)
    expect(out).toBe(input)
    expect(seen).toEqual([])
  })

  test('a compressed body is forwarded untouched and never parsed', async () => {
    const input = delta('text_delta', [1, 2])
    const seen: { count: number; kind: TokenChunkKind }[] = []
    const out = await new Response(
      anthropicTokenTap(source(input), {
        onTokenIds: (count, kind) => seen.push({ count, kind }),
        contentEncoding: 'gzip',
      }),
    ).text()
    expect(out).toBe(input)
    expect(seen).toEqual([])
  })

  test('without an onTokenIds callback the stream is returned as-is', () => {
    const stream = source('data: {}\n\n')
    expect(anthropicTokenTap(stream, {})).toBe(stream)
  })
})
