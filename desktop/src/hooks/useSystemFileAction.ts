import { useTranslation } from '@/i18n'
import { downloadLocalFile } from '@/lib/handlePreviewLink'
import { canOpenWithSystem, openFileWithSystemOrOfferSave } from '@/lib/systemFileOpen'

export type SystemFileAction = {
  /** Whether this runtime can hand the file to a system application at all. */
  canOpen: boolean
  /** The action's own name — "open in system app", or the save that replaces it. */
  label: string
  run: () => void
}

/**
 * What "open this file outside the workspace" means on this runtime.
 *
 * One decision in one place, because the answer is a property of the runtime and
 * not of the surface asking: where a system shell exists the file goes to its
 * default application, and where none does (the browser and the H5 surface) "the
 * system" would be the *server's* desktop — so the same affordance becomes a save
 * to the user's own device.
 *
 * Callers read the label from here as well as the action, so no surface promises
 * an open it cannot perform. Icons stay at the call site, since they are sized to
 * the surrounding toolbar.
 */
export function useSystemFileAction(absolutePath: string): SystemFileAction {
  const t = useTranslation()
  const canOpen = canOpenWithSystem()

  return {
    canOpen,
    label: canOpen ? t('workspace.openInSystemApp') : t('workspace.download'),
    run: () => {
      if (canOpen) openFileWithSystemOrOfferSave(absolutePath)
      else downloadLocalFile(absolutePath)
    },
  }
}
