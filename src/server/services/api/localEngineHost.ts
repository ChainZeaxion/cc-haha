/**
 * Whether a host names a machine-local or LAN engine (a vLLM-family server)
 * rather than a public API.
 *
 * These are the endpoints we know how to talk to with vLLM extensions — an
 * unknown parameter is harmless there, whereas a hosted endpoint may reject the
 * request outright — and the ones whose traffic is cheap to route through the
 * local proxy so the TPS meter can read per-chunk token ids.
 */
export function isLocalEngineHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true
  if (host === '0.0.0.0' || host === '127.0.0.1' || host.startsWith('127.')) return true
  const octets = host.split('.')
  if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) return false
  const [a, b] = octets.map(Number) as [number, number, number, number]
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

/** Same question for a full base URL; false when it does not parse. */
export function isLocalEngineUrl(baseUrl: string): boolean {
  try {
    return isLocalEngineHost(new URL(baseUrl).hostname)
  } catch {
    return false
  }
}

/**
 * Whether a host is on a private network (RFC 1918) — the LAN an engine can sit
 * on — as opposed to loopback or a public address.
 *
 * Loopback is deliberately excluded where this gates *routing*: a 127.0.0.1
 * base is just as likely to be a local gateway or a test double, and silently
 * sending its traffic through our proxy would change its auth and non-Messages
 * paths. A LAN address is remote infrastructure we can recognise as an engine.
 */
export function isPrivateNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const octets = host.split('.')
  if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) return false
  const [a, b] = octets.map(Number) as [number, number, number, number]
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

/** Same question for a full base URL; false when it does not parse. */
export function isPrivateNetworkUrl(baseUrl: string): boolean {
  try {
    return isPrivateNetworkHost(new URL(baseUrl).hostname)
  } catch {
    return false
  }
}
