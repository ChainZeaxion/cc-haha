import { copyFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import type { BrowserWindow } from 'electron'
import type { DesktopFileSaveResult } from '../../src/lib/desktopHost/types'
import { saveDialog } from './dialogs'

export type FileSaveCopyInput = {
  sourcePath: string
  suggestedName?: string
}

/**
 * Save a copy of a local file where the user chooses.
 *
 * Copying belongs in the main process. The renderer could fetch the bytes and
 * hand them to the DOM, but every route it tried failed for reasons that are
 * invisible to it: a download it starts itself is a cross-site request from the
 * `file://` page's opaque origin and the server refuses `null` (403), and a
 * `blob:` URL minted in that opaque origin is not downloadable either — which is
 * why the click produced nothing at all instead of an error. Handing the source
 * path here skips origin, CORS and blob entirely: the file is already on this
 * machine, so the only work left is a copy.
 *
 * The destination is decided by the dialog, never by the caller, so the renderer
 * gains no ability to write to a path of its choosing — it can only propose the
 * name the dialog starts with.
 */
export async function saveFileCopy(
  parentWindow: BrowserWindow | null,
  input: FileSaveCopyInput,
): Promise<DesktopFileSaveResult> {
  const { sourcePath, suggestedName } = input
  if (!isAbsolute(sourcePath)) {
    return { saved: false, reason: 'invalid-source' }
  }
  const name = suggestedName && !suggestedName.includes('/') && !suggestedName.includes('\\')
    ? suggestedName
    : basename(sourcePath)
  const destination = await saveDialog(parentWindow, {
    defaultPath: join(downloadsDirectory(), name),
    // The dialog must not offer to overwrite the file being copied.
    filters: undefined,
  })
  if (!destination) return { saved: false, reason: 'cancelled' }
  if (destination === sourcePath) return { saved: true, path: destination }
  try {
    await copyFile(sourcePath, destination)
  } catch (error) {
    return {
      saved: false,
      reason: 'copy-failed',
      message: error instanceof Error ? error.message : String(error),
    }
  }
  return { saved: true, path: destination }
}

/**
 * Where the dialog should open. Electron resolves the platform's downloads
 * directory; this machine's XDG entry points at a localised path, and the
 * conventional `~/Downloads` does not exist here, so asking Electron is the only
 * way to land somewhere real.
 */
function downloadsDirectory(): string {
  // Lazy so importing this module never touches the electron module before the
  // app is ready.
  const { app } = require('electron') as typeof import('electron')
  try {
    return app.getPath('downloads')
  } catch {
    return app.getPath('home')
  }
}
