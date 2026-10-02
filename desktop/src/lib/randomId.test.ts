import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomId } from './randomId'

/** The server validates side-chat ids with `z.uuid()`, so the shape is load-bearing. */
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.restoreAllMocks())

describe('randomId', () => {
  it('returns a unique v4 uuid while the secure-context API is present', () => {
    const ids = new Set(Array.from({ length: 200 }, () => randomId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(V4)
  })

  it('still returns a valid v4 uuid when crypto.randomUUID is missing (http LAN)', () => {
    // The reported failure: H5 over http://192.168.x.x, where randomUUID is
    // absent (a non-secure context). No throw, and the id still passes the
    // server's z.uuid().
    const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID')
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const ids = Array.from({ length: 50 }, () => randomId())
      for (const id of ids) expect(id).toMatch(V4)
      expect(new Set(ids).size).toBe(50)
    } finally {
      if (descriptor) Object.defineProperty(globalThis.crypto, 'randomUUID', descriptor)
      else delete (globalThis.crypto as { randomUUID?: unknown }).randomUUID
    }
  })

  it('falls back to Math.random when Web Crypto is unavailable entirely', () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      const ids = Array.from({ length: 50 }, () => randomId())
      for (const id of ids) expect(id).toMatch(V4)
      expect(new Set(ids).size).toBe(50)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    }
  })
})
