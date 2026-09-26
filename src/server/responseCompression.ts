import { gzipSync } from 'node:zlib'
import { isLoopbackHost } from './h5AccessPolicy.js'

/**
 * Transport compression for non-local API responses.
 *
 * Opening a large H5 session transfers the whole transcript paged from the
 * sidecar (measured: ~140 MB / 701 pages for one 37k-message session).
 * Loopback desktop traffic stays uncompressed to preserve the local
 * zero-overhead path; remote (H5) responses are gzip-compressed when the
 * client advertises `Accept-Encoding: gzip` and the body is large enough
 * for the CPU cost to pay off.
 *
 * Browsers decompress gzip transparently inside `fetch()` — `res.text()` /
 * `res.json()` see the plain JSON either way — so no client change is
 * required. Compression is best-effort: any failure returns the original
 * response untouched.
 */

// Below this size the win is marginal (a ~200 KB page compresses to ~70 KB).
const MIN_COMPRESS_BYTES = 128 * 1024

const DEBUG_LOG_LIMIT = 5

let debugLogsEmitted = 0

export function shouldGzipResponse(
  request: Request,
  response: Response,
  clientAddress: string | null,
): boolean {
  if (process.env.CC_HAHA_TRANSPORT_GZIP === '0') return false
  if (request.method !== 'GET' || response.status !== 200) return false
  if (!response.body) return false

  const acceptEncoding = request.headers.get('accept-encoding')?.toLowerCase() ?? ''
  if (!acceptEncoding.includes('gzip')) return false

  // Remote by default; loopback only skips compression unless forced on.
  const isLocal = clientAddress !== null && isLoopbackHost(clientAddress)
  if (isLocal && process.env.CC_HAHA_TRANSPORT_GZIP !== '1') return false

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) return false

  // Response.json does not always set content-length, so this is a fast skip
  // only; the authoritative size check happens after the body is read in
  // withGzipIfEligible.
  const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(declared) && declared > 0 && declared < MIN_COMPRESS_BYTES) {
    return false
  }
  return true
}
export async function withGzipIfEligible(
  request: Request,
  response: Response,
  clientAddress: string | null,
): Promise<Response> {
  if (!shouldGzipResponse(request, response, clientAddress)) return response
  let raw: Uint8Array
  try {
    raw = new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    // Body already consumed (abort mid-read). The caller's abort path owns
    // that case; surface the original response shape.
    console.warn(
      '[Server] gzip transport read failed, sending original response:',
      error instanceof Error ? error.message : String(error),
    )
    return response
  }
  // The body was consumed by arrayBuffer(); any non-compressed fallback must
  // rebuild a Response from `raw` or the client receives an empty body.
  const passthrough = () =>
    new Response(raw, {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    })

  if (raw.length < MIN_COMPRESS_BYTES) return passthrough()

  let compressed: Uint8Array
  try {
    compressed = new Uint8Array(gzipSync(raw, { level: 6 }))
  } catch (error) {
    console.warn(
      '[Server] gzip compression failed, sending uncompressed:',
      error instanceof Error ? error.message : String(error),
    )
    return passthrough()
  }
  if (compressed.length >= raw.length) return passthrough()

  if (debugLogsEmitted < DEBUG_LOG_LIMIT) {
    debugLogsEmitted += 1
    console.log(
      `[Server] gzip transport: ${(raw.length / 1024 / 1024).toFixed(2)}MB -> ` +
        `${(compressed.length / 1024 / 1024).toFixed(2)}MB ` +
        `(${(raw.length / compressed.length).toFixed(1)}x) ${request.method} ${request.url}`,
    )
  }
  return new Response(compressed, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'content-encoding': 'gzip',
      'content-length': String(compressed.length),
      'cache-control': 'no-store',
    },
  })
}
