import { describe, expect, test } from 'bun:test'
import {
  estimateTokensByCharClass,
  pngDimensionsFromBase64,
  roughTokenCountEstimationForContent,
  roughTokenCountEstimationForThinking,
} from './tokenEstimation.js'
import { OPENAI_REASONING_ENVELOPE_PREFIX } from '../utils/openAIReasoningEnvelope.js'

describe('image token estimation', () => {
  // A PNG's IHDR sits at a fixed offset, so the first 24 bytes carry the
  // dimensions. Values below are the engine's own counts for the same sizes,
  // measured on the local endpoint (32px patch tokenizer).
  const png = (width: number, height: number): string => {
    const header = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0)
    header.writeUInt32BE(13, 8)
    header.write('IHDR', 12, 'latin1')
    header.writeUInt32BE(width, 16)
    header.writeUInt32BE(height, 20)
    return header.toString('base64')
  }
  const imageBlock = (data: string) =>
    [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data } }] as never

  test('reads PNG dimensions from the base64 head', () => {
    expect(pngDimensionsFromBase64(png(1280, 577))).toEqual({ width: 1280, height: 577 })
    expect(pngDimensionsFromBase64('not-a-png-at-all-not-a-png-at-all')).toBeNull()
  })

  test('prices an image by its pixels instead of a flat constant', () => {
    const original = process.env.ANTHROPIC_BASE_URL
    try {
      // Patch-tokenizing third-party engine: 1280x577 bills 721 in reality, and
      // the flat 2000 this replaced was 2.77x high — enough to push the meter
      // past the real prompt.
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:8866'
      expect(roughTokenCountEstimationForContent(imageBlock(png(1280, 577)))).toBe(722)
      // A small image costs a small amount — a constant cannot express that.
      expect(roughTokenCountEstimationForContent(imageBlock(png(256, 256)))).toBe(64)

      // First-party Anthropic documents (w*h)/750.
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'
      expect(roughTokenCountEstimationForContent(imageBlock(png(1280, 577)))).toBe(985)
    } finally {
      if (original === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = original
    }
  })

  test('falls back to the cap when the payload is not a readable PNG', () => {
    expect(roughTokenCountEstimationForContent(imageBlock('x'.repeat(400)))).toBe(2000)
  })
})

describe('estimateTokensByCharClass', () => {
  // Expected values are the engine's own `count_tokens` output for the same
  // strings (measured against the local zxsv-ai endpoint). A flat length/4 sat
  // 30-60% off on most of these; the class weighting is what keeps the estimate
  // usable as the trigger's second opinion.
  const engineSamples: Array<[string, string, number]> = [
    ['English prose', 'The quick brown fox jumps over the lazy dog. '.repeat(200), 1999],
    ['Chinese prose', '敏捷的棕色狐狸跳过了懒惰的狗。'.repeat(200), 1999],
    ['mixed zh/en', 'The quick brown fox 敏捷的棕色狐狸 jumps over 跳过了 the lazy dog. '.repeat(100), 1799],
    ['code', 'function foo(a, b) { return a + b; } // comment\n'.repeat(200), 3198],
    ['JSON', '{"key": "value", "num": 123, "arr": [1,2,3]}'.repeat(200), 4799],
    ['Chinese technical', '修复后的路由放行策略需要同步更新 patch 基线，逐字节比对确保一致。'.repeat(60), 1139],
  ]

  for (const [name, text, engineTokens] of engineSamples) {
    test(`stays within 15% of the engine on ${name}`, () => {
      const estimate = estimateTokensByCharClass(text)
      expect(Math.abs(estimate - engineTokens) / engineTokens).toBeLessThan(0.16)
    })
  }

  test('charges a numeral per character — this engine does not merge digit runs', () => {
    expect(estimateTokensByCharClass('12345')).toBe(5)
    expect(estimateTokensByCharClass('M412 108')).toBe(7) // M + 4,1,2 + 1,0,8
  })

  test('does not charge for whitespace', () => {
    expect(estimateTokensByCharClass('   \n\n\t  ')).toBe(0)
  })

  test('charges every short identifier a whole token', () => {
    // `a` and `b` are one token each — dividing their length by 4 was what made
    // code and paths read far cheaper than the engine billed them.
    expect(estimateTokensByCharClass('a b c')).toBe(3)
  })
})

describe('roughTokenCountEstimationForContent', () => {
  test('does not treat OpenAI encrypted reasoning bytes as plaintext tokens', () => {
    const data = `${OPENAI_REASONING_ENVELOPE_PREFIX}${JSON.stringify({
      id: 'rs_test',
      summary: [{ type: 'summary_text', text: 'visible summary' }],
      encrypted_content: 'x'.repeat(400_000),
    })}`

    expect(
      roughTokenCountEstimationForContent([
        { type: 'redacted_thinking', data },
      ]),
    ).toBe(3)
  })

  test('keeps estimating non-OpenAI redacted thinking payloads', () => {
    expect(
      roughTokenCountEstimationForContent([
        { type: 'redacted_thinking', data: 'x'.repeat(400) },
      ]),
    ).toBe(89)
  })
})

describe('roughTokenCountEstimationForThinking', () => {
  // Stands in for the engine's reasoning count where it reports none, so the
  // split between deliberation and answer stays available on any endpoint.
  test('counts thinking blocks only', () => {
    // The thinking block is one 600-char word → 600/4.5 ≈ 133 tokens; the text
    // block's 800 chars belong to the output total and must not be added here.
    const estimate = roughTokenCountEstimationForThinking([
      { type: 'thinking', thinking: 'x'.repeat(600) },
      { type: 'text', text: 'y'.repeat(800) },
    ])
    expect(estimate).toBe(133)
  })

  test('reads nothing from a turn that did not think', () => {
    expect(roughTokenCountEstimationForThinking([{ type: 'text', text: 'answer' }])).toBe(0)
    expect(roughTokenCountEstimationForThinking('plain string content')).toBe(0)
    expect(roughTokenCountEstimationForThinking(undefined)).toBe(0)
  })

  test('includes redacted thinking, which is thinking the reader cannot see', () => {
    expect(
      roughTokenCountEstimationForThinking([
        { type: 'redacted_thinking', data: 'x'.repeat(400) },
      ]),
    ).toBe(89)
  })
})
