import { afterEach, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { sideChatsApi } from './sideChats'
vi.mock('@/api/client', () => ({ api: { post: vi.fn(), delete: vi.fn() } }))

afterEach(() => vi.restoreAllMocks())

it('uses an independent idempotency id and encodes both parent and child path components', () => {
  sideChatsApi.create('parent/one')
  expect(api.post).toHaveBeenCalledWith('/api/sessions/parent%2Fone/side-chats', { sideChatId: expect.stringMatching(/^[a-f0-9-]{36}$/) })
  sideChatsApi.discard('parent/one', 'side-child/two')
  expect(api.delete).toHaveBeenCalledWith('/api/sessions/parent%2Fone/side-chats/side-child%2Ftwo')
})

it('creates a side chat from a non-secure context (http LAN), where randomUUID is absent', () => {
  // The reported failure: clicking the session's "?" (side chat) over
  // http://192.168.x.x threw "crypto.randomUUID is not a function". The id must
  // still be a uuid, because the server validates it with z.uuid().
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID')
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
  try {
    expect(() => sideChatsApi.create('parent')).not.toThrow()
    expect(api.post).toHaveBeenCalledWith('/api/sessions/parent/side-chats', { sideChatId: expect.stringMatching(/^[a-f0-9-]{36}$/) })
  } finally {
    if (descriptor) Object.defineProperty(globalThis.crypto, 'randomUUID', descriptor)
    else delete (globalThis.crypto as { randomUUID?: unknown }).randomUUID
  }
})
