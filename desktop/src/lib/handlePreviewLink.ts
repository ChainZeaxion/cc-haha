import { apiGetBlob } from '../api/client'
import { classifyPreviewLink } from './previewLinkRouter'
import { shouldOfferStaticHtmlPreview } from './htmlPreviewPolicy'

export type PreviewLinkReveal = { line: number; column?: number }

export type PreviewLinkDeps = {
  sessionId: string
  serverBaseUrl: string
  openBrowser: (sessionId: string, url: string) => void
  /** `reveal` carries the `:42` suffix through to the code view's scroll target. */
  openFilePreview: (sessionId: string, path: string, reveal?: PreviewLinkReveal) => void
  openSystemFile: (path: string) => void
  openExternal: (url: string) => void
}

/**
 * Build a `/preview-fs/<sessionId>/<path>` URL for the local server.
 *
 * Absolute file paths (leading slash) are preserved as-is, so the resulting URL
 * carries a `//` between `<sessionId>` and the path. That double slash is
 * intentional: the server slices everything after the `<sessionId>` segment and
 * runs `path.resolve(workDir, relPath)`, so an absolute path is resolved as an
 * absolute-within-workspace path and sandbox-checked against the work dir root.
 */
export function previewFsUrl(base: string, sessionId: string, filePath: string): string {
  return `${base.replace(/\/$/, '')}/preview-fs/${encodeURIComponent(sessionId)}/${filePath.replace(/^\/+/, '/')}`
}

/** True for POSIX absolute (`/...`) or Windows drive (`X:\` / `X:/`) paths. */
export function isAbsoluteLocalPath(p: string): boolean {
  return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p)
}

/** Paths rooted outside the workspace, including the server-expanded home alias. */
export function isRootedLocalPath(p: string): boolean {
  return isAbsoluteLocalPath(p) || /^~(?:[\\/]|$)/.test(p)
}

/**
 * Build a `/local-file/<absolute-path>` URL for the local server so an absolute
 * file outside the session workspace can open in the in-app browser. Home aliases
 * (`~/...`) are expanded by the server before the same filesystem checks.
 *
 * The path is appended PATH-style (not as a query param) so relative asset URLs
 * inside served HTML resolve against the same directory. Each path segment is
 * `encodeURIComponent`-escaped (so spaces / unicode survive) while the `/`
 * separators are preserved. A Windows drive path (`C:\proj\page.html`) has its
 * backslashes normalized to `/`; the leading separator is always present so the
 * server can re-root the path.
 */
export function localFileUrl(base: string, absPath: string): string {
  const withForwardSlashes = absPath.replace(/\\/g, '/')
  const withLeadingSlash = withForwardSlashes.startsWith('/')
    ? withForwardSlashes
    : `/${withForwardSlashes}`
  const encoded = withLeadingSlash
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base.replace(/\/$/, '')}/local-file${encoded}`
}

/**
 * Save a file through the local server's `/local-file/<abs-path>?download=1`
 * route.
 *
 * The bytes are fetched through the app's own API client and handed to the DOM as
 * a blob URL, instead of pointing an anchor straight at the route. A URL the DOM
 * loads is a request the browser issues by itself, and it carries neither the
 * Authorization header the API client attaches nor an Origin the server trusts:
 * the packaged renderer runs at `file://`, whose origin serializes to `null` for
 * exactly this kind of request, and the server refuses `null`. Measured against
 * the running app — the same route answers 200 for no Origin and 403
 * `CORS origin not allowed` for `Origin: null`, which is why the download began
 * and then failed ("无法从网站上提取文件") rather than never starting.
 *
 * Fetching first uses the credential path every other call already uses;
 * `apiGetBlob` documents the same reasoning for app icons, which hit the
 * identical wall. The cost is that the file is held in memory to build the blob,
 * the trade this app already makes for its icon and export downloads.
 *
 * @returns whether the file was handed to the browser to save.
 */
export async function downloadLocalFile(absolutePath: string): Promise<boolean> {
  try {
    // An empty base so the helper yields the path the API client wants.
    const path = `${localFileUrl('', absolutePath)}?download=1`
    const blob = await apiGetBlob(path)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    // Still named here: the blob URL has no filename of its own, so the server's
    // Content-Disposition cannot drive the saved name through this path.
    anchor.download = fileNameFromPath(absolutePath)
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Released on the next task: the click above has already been dispatched, and
    // revoking synchronously can cancel a download that has not started yet.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch (error) {
    console.warn(
      `[download] ${absolutePath} failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return false
  }
}

/** Last path segment, for the download's suggested save name. */
export function fileNameFromPath(filePath: string): string {
  const segments = filePath.split(/[\\/]/).filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? ''
}

/** Returns true if handled (caller should preventDefault). */
export function handlePreviewLink(href: string, deps: PreviewLinkDeps): boolean {

  const cls = classifyPreviewLink(href)
  const reveal: PreviewLinkReveal | undefined = cls.line
    ? { line: cls.line, ...(cls.column ? { column: cls.column } : {}) }
    : undefined
  switch (cls.kind) {
    case 'browser-localhost':
      deps.openBrowser(deps.sessionId, cls.url!)
      return true
    case 'browser-file': {
      const filePath = cls.path!
      // Absolute and home-relative paths may live OUTSIDE the session
      // workspace, so serve them via the $HOME-sandboxed /local-file route.
      // Relative paths stay workspace-scoped via /preview-fs.
      if (!isRootedLocalPath(filePath) && !shouldOfferStaticHtmlPreview(filePath)) {
        deps.openFilePreview(deps.sessionId, filePath, reveal)
        return true
      }
      const url = isRootedLocalPath(filePath)
        ? localFileUrl(deps.serverBaseUrl, filePath)
        : previewFsUrl(deps.serverBaseUrl, deps.sessionId, filePath)
      deps.openBrowser(deps.sessionId, url)
      return true
    }
    case 'file-preview':
      deps.openFilePreview(deps.sessionId, cls.path!, reveal)
      return true
    case 'system-file':
      deps.openSystemFile(cls.path!)
      return true
    case 'remote':
      deps.openExternal(cls.url!)
      return true
    default:
      return false
  }
}
