import { openTargetsApi } from '../api/openTargets'
import { getDesktopHost } from './desktopHost'
import { t } from '../i18n'
import { useUIStore } from '../stores/uiStore'

/**
 * Say that a path could not be opened, naming it.
 *
 * Every one of these paths comes from something the assistant wrote — prose, a
 * checkpoint, a directory listing — and any of them can outlive the file. The
 * failures used to land in floating promises, so a click on a stale reference
 * did nothing at all and read as a broken button.
 */
export function reportOpenFailure(path: string): void {
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path
  useUIStore.getState().addToast({ type: 'error', message: t('openWith.openFailed', { name }) })
}

export function resolveAbsoluteOpenPath(path: string, workDir?: string): string {
  if (path === '~' || path.startsWith('~/') || path.startsWith('~\\')) return path
  if (path.startsWith('/') || path.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(path) || !workDir) return path
  return `${workDir.replace(/[\\/]+$/, '')}/${path.replace(/^[\\/]+/, '')}`
}

/**
 * Raised when there is no desktop shell to open a file with.
 *
 * Distinct from a failed open: the caller can offer a different way out (a
 * download), whereas a genuine failure deserves the error toast.
 */
export class SystemOpenUnavailableError extends Error {
  readonly code = 'system-open-unavailable'

  constructor(path: string) {
    super(`Opening ${path} with a system application requires the desktop app runtime.`)
    this.name = 'SystemOpenUnavailableError'
  }
}

/** Whether this runtime has a system shell to hand a file to. */
export function canOpenWithSystem(): boolean {
  return getDesktopHost().capabilities.shell
}

/**
 * Prefer Electron's guarded shell bridge. Desktop builds fall back to the local
 * server's equally validated system-default target when the bridge fails.
 *
 * A runtime with no shell throws {@link SystemOpenUnavailableError} *before* that
 * fallback is reached. The fallback launches the file through the server host —
 * the right answer when the server *is* the user's machine, and the wrong one on
 * the H5 surface, where it opened the file in the server's desktop session
 * instead of on the phone. There the user gets a download instead.
 */
export async function openLocalFileWithSystem(path: string): Promise<void> {
  if (!canOpenWithSystem()) throw new SystemOpenUnavailableError(path)
  try {
    await getDesktopHost().shell.openPath(path)
    return
  } catch {
    const result = await openTargetsApi.listForPath(path)
    const target = result.targets.find((candidate) => candidate.kind === 'system_default')
    if (!target) throw new Error('No system application is available for this file')
    await openTargetsApi.open(target.id, path)
  }
}

/**
 * The one entry point for a click that means "open this file", wherever it came
 * from — a turn-changes row, a link in the prose, an output card.
 *
 * It exists so that "there is no system application here" is answered the same
 * way everywhere: with the save dialog, instead of the error toast a genuine
 * failure gets. Left to each call site, the browser surface's answer drifted into
 * an error toast that named the file and offered nothing to do about it.
 *
 * `path` must be absolute — it is what the save dialog downloads.
 */
export function openFileWithSystemOrOfferSave(path: string): void {
  void openLocalFileWithSystem(path).catch((error: unknown) => {
    if (error instanceof SystemOpenUnavailableError) {
      useUIStore.getState().showFileUnavailable({
        absolutePath: path,
        name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
        reason: 'no-viewer',
        canDownload: true,
      })
      return
    }
    reportOpenFailure(path)
  })
}
