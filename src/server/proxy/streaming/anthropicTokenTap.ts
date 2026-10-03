import type { TokenChunkKind } from './openaiChatStreamToAnthropic.js'

export interface AnthropicTokenTapOptions {
  /**
   * Called with the number of ids the upstream attached to a
   * `content_block_delta` (vLLM-family `token_ids`), tagged with what the delta
   * carries. Never called for a delta that carried no ids — which is how the
   * caller learns that the endpoint does not report them.
   */
  onTokenIds?: (count: number, kind: TokenChunkKind) => void
  /**
   * `Content-Encoding` of the upstream body. The tap only parses plain SSE: a
   * compressed body is forwarded untouched and simply yields no ids (the local
   * engines that report `token_ids` do not compress their event streams).
   */
  contentEncoding?: string
}

/** Which counter a delta's ids belong to, by the delta's own type. */
const DELTA_KINDS: Record<string, TokenChunkKind> = {
  thinking_delta: 'thinking',
  text_delta: 'content',
  input_json_delta: 'tool',
}

/** Reads `data:` events off an SSE text stream and reports their `token_ids`. */
class SseTokenReader {
  private buffer = ''

  constructor(
    private readonly onTokenIds: (count: number, kind: TokenChunkKind) => void,
  ) {}

  push(text: string): void {
    this.buffer += text
    let newline = this.buffer.indexOf('\n')
    while (newline !== -1) {
      this.consumeLine(this.buffer.slice(0, newline))
      this.buffer = this.buffer.slice(newline + 1)
      newline = this.buffer.indexOf('\n')
    }
  }

  private consumeLine(rawLine: string): void {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    let event: { type?: string; delta?: { type?: string }; token_ids?: unknown }
    try {
      event = JSON.parse(payload)
    } catch {
      return
    }
    if (event.type !== 'content_block_delta' || !Array.isArray(event.token_ids)) return
    if (event.token_ids.length === 0) return
    this.onTokenIds(event.token_ids.length, DELTA_KINDS[event.delta?.type ?? ''] ?? 'content')
  }
}

/**
 * Returns a stream that forwards every chunk of `stream` byte-for-byte while
 * parsing the SSE events inside it on the side for the per-chunk `token_ids` a
 * vLLM-family engine attaches to its deltas.
 *
 * Mirrors the captureTraceStream tee in handler.ts, but keeps no buffer — the
 * only state is the current unterminated line — so the cost of a long body is
 * bounded by its events, not its size.
 *
 * `pipeThrough` (rather than hand-rolling a reader) keeps the forwarded body a
 * plain stream the runtime can still hand to a Response untouched.
 */
export function anthropicTokenTap(
  stream: ReadableStream<Uint8Array>,
  options: AnthropicTokenTapOptions,
): ReadableStream<Uint8Array> {
  const { onTokenIds, contentEncoding } = options
  if (!onTokenIds) return stream

  // Anything but an unencoded body cannot be parsed line-wise here. Forward it
  // and report no ids rather than risk mangling the stream.
  const encoding = (contentEncoding ?? '').trim().toLowerCase()
  if (encoding && encoding !== 'identity') return stream

  const reader = new SseTokenReader(onTokenIds)
  const decoder = new TextDecoder()

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        // Forward first: the client's bytes must never wait on the side parse.
        controller.enqueue(chunk)
        reader.push(decoder.decode(chunk, { stream: true }))
      },
      flush() {
        reader.push(decoder.decode())
      },
    }),
  )
}
