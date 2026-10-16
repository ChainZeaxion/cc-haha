import { describe, expect, test } from 'bun:test'
import { getCacheControl } from './claude.js'

describe('getCacheControl TTL resolution', () => {
  test('returns a 6h TTL when the target endpoint sits on a private network', () => {
    const originalBaseUrl = process.env.ANTHROPIC_BASE_URL
    process.env.ANTHROPIC_BASE_URL = 'http://192.168.1.50:8000/v1'

    try {
      expect(getCacheControl({ querySource: 'repl_main_thread' })).toEqual({
        type: 'ephemeral',
        ttl: '6h',
      })
    } finally {
      if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = originalBaseUrl
    }
  })

  test('returns a 6h TTL for a loopback local engine', () => {
    const originalBaseUrl = process.env.ANTHROPIC_BASE_URL
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:8000/v1'

    try {
      expect(getCacheControl()).toEqual({ type: 'ephemeral', ttl: '6h' })
    } finally {
      if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = originalBaseUrl
    }
  })

  test('does not emit a TTL on a public endpoint without 1h eligibility', () => {
    const originalBaseUrl = process.env.ANTHROPIC_BASE_URL
    const originalUserType = process.env.USER_TYPE
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'
    process.env.USER_TYPE = ''

    try {
      expect(getCacheControl({ querySource: 'repl_main_thread' })).toEqual({
        type: 'ephemeral',
      })
    } finally {
      if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = originalBaseUrl
      if (originalUserType === undefined) delete process.env.USER_TYPE
      else process.env.USER_TYPE = originalUserType
    }
  })
})
