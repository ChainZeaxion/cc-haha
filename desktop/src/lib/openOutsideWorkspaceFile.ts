import { api } from '@/api/client'
import { sessionsApi } from '@/api/sessions'
import { isWorkspaceImageFile, isWorkspaceMediaFile, isWorkspacePreviewableFile } from './fileCapabilities'
import { fileNameFromPath, localFilePath } from './handlePreviewLink'
import { workspaceOpen } from './workspace/openTarget'
import type { WorkspaceOrigin } from '@/stores/workspaceStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * The size past which an image is refused rather than drawn.
 *
 * Images only: an image is the one preview the server carries whole, as a base64
 * data URL, so its size is memory on both ends and has to be weighed before the
 * click. Text is not capped here — the server sends its head and flags it, which
 * is a better answer than a refusal (see `MAX_PREVIEW_BYTES`), and media streams
 * from the path. Mirrors the server's own ceiling.
 */
export const MAX_IMAGE_PREVIEW_BYTES = 16 * 1024 * 1024

type LocalFileInfo = { name: string; size: number; mime: string }

/**
 * Ask the server about a path it may not be willing to serve, without reading it.
 *
 * `/local-file/:path?info=1` returns name, size and mime from a `stat` alone, and
 * refuses a path outside the roots it serves the same way the content routes do —
 * so a `null` here is the honest answer to "can this be shown or saved at all",
 * and the size is known before anything is transferred.
 */
export async function fetchLocalFileInfo(absolutePath: string): Promise<LocalFileInfo | null> {
  try {
    return await api.get<LocalFileInfo>(`${localFilePath(absolutePath)}?info=1`)
  } catch {
    return null
  }
}

/**
 * Whether the *workspace* routes will serve this path.
 *
 * A different gate from `/local-file`'s: the workspace route accepts an absolute
 * path only inside a registered root, so a file can be servable by one route and
 * refused by the other. Asking first is what keeps a click from opening a tab
 * that renders a refusal.
 */
async function workspaceCanServe(sessionId: string, absolutePath: string): Promise<boolean> {
  try {
    await sessionsApi.getWorkspaceFile(sessionId, absolutePath)
    return true
  } catch {
    return false
  }
}

/**
 * Open a file that lives outside the session workspace — or explain why it cannot
 * be opened here.
 *
 * Called instead of a bare `workspaceOpen.file` because that is what made these
 * clicks dead: the workspace route refuses a path outside its roots, so the tab
 * opened onto a 403 and the download beneath it was never reached either. The
 * decision is made from the server's own answers (size, then reachability) rather
 * than from the extension or from a guess.
 */
export function openFileOutsideWorkspace(options: {
  sessionId: string
  /** Absolute, or `~/`-rooted: what the filesystem routes take. */
  absolutePath: string
  /** The path as the conversation wrote it, used for the extension and the name. */
  displayPath: string
  reveal?: { line: number; column?: number }
  /** Chat element that asked, so the conversation can scroll back to it. */
  origin?: WorkspaceOrigin
}): void {
  const { sessionId, absolutePath, displayPath, reveal, origin } = options
  const name = fileNameFromPath(absolutePath) || displayPath
  const report = (reason: 'no-viewer' | 'too-large' | 'outside-workspace', extra?: { size?: number; canDownload: boolean }) =>
    useUIStore.getState().showFileUnavailable({
      absolutePath,
      name,
      reason,
      canDownload: extra?.canDownload ?? true,
      ...(extra?.size === undefined ? {} : { size: extra.size }),
    })

  void (async () => {
    const info = await fetchLocalFileInfo(absolutePath)
    if (!info) {
      // Outside every root the server serves. Nothing here can show *or* save it,
      // so the message says that instead of offering a save that cannot work.
      report('outside-workspace', { canDownload: false })
      return
    }
    if (isWorkspaceImageFile(displayPath) && info.size > MAX_IMAGE_PREVIEW_BYTES) {
      report('too-large', { size: info.size, canDownload: true })
      return
    }
    if (!isWorkspacePreviewableFile(displayPath)) {
      // Small enough to fetch, but this runtime has no surface that draws it —
      // an Office package, an archive. There is no system application either, so
      // the save is the whole answer.
      report('no-viewer', { canDownload: true })
      return
    }
    // Media is played from the path by `/local-file`, which the metadata read
    // above already proved serves it, so the workspace route's answer is beside
    // the point for it.
    if (!isWorkspaceMediaFile(displayPath) && !(await workspaceCanServe(sessionId, absolutePath))) {
      report('outside-workspace', { canDownload: true })
      return
    }
    workspaceOpen.file(sessionId, absolutePath, {
      ...(reveal ? { line: reveal.line, ...(reveal.column ? { column: reveal.column } : {}) } : {}),
      ...(origin ? { origin } : {}),
      requestedBy: 'user',
    })
  })()
}
