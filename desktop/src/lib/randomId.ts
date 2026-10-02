/**
 * A random RFC 4122 version-4 UUID.
 *
 * `crypto.randomUUID` exists only in a **secure context**. The H5 client is
 * commonly reached over plain http on a LAN address (http://192.168.x.x:port),
 * which is not secure, so the call is simply absent there and throws
 * "crypto.randomUUID is not a function" — the session's side-chat "?" button
 * died on exactly that, because the server validates its id with `z.uuid()`.
 *
 * `crypto.getRandomValues` carries no secure-context restriction, so the UUID
 * is built from it. The `Math.random` branch is only for an environment with no
 * Web Crypto at all, and still produces a shape-valid v4 id so the server's
 * `z.uuid()` accepts it.
 */
export function randomId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  // Version 4, variant 1 (RFC 4122 §4.4).
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return (
    `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-` +
    `${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
  )
}
