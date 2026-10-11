import { ActionDialog } from '@/components/ui/ActionDialog'
import { useTranslation, type TranslationKey } from '@/i18n'
import { formatBytes } from '@/lib/formatBytes'
import { downloadLocalFile } from '@/lib/handlePreviewLink'
import { useUIStore, type UnavailableFile } from '@/stores/uiStore'

/**
 * The way out when the user asked to open a file this runtime cannot open.
 *
 * Only the runtimes without a system shell reach it: there the file used to be
 * launched on the *server's* desktop, which is where nobody was looking. A save
 * to the device is the one action that still gets the user the file, so it is the
 * action offered when it can work.
 *
 * Which reason it gives is the useful part — "too large", "outside the workspace"
 * and "nothing here can draw this" are three different situations, and a single
 * "could not open" would leave the user guessing which one they hit.
 *
 * Mounted once per shell, beside the toasts — see `AppShell`.
 */
export function FileUnavailableDialog() {
  const t = useTranslation()
  const file = useUIStore((state) => state.unavailableFile)
  const dismiss = useUIStore((state) => state.dismissFileUnavailable)

  return (
    <ActionDialog
      open={file !== null}
      onClose={dismiss}
      title={t('workspace.fileUnavailable.title')}
      body={t(bodyKeyFor(file), bodyVarsFor(file))}
      actions={[
        ...(file?.canDownload
          ? [{
              label: t('workspace.download'),
              variant: 'primary' as const,
              onClick: () => {
                downloadLocalFile(file.absolutePath)
                dismiss()
              },
            }]
          : []),
        { label: t('common.close'), onClick: dismiss },
      ]}
    />
  )
}

/** The message is chosen by *why* it could not be opened, not by the file's kind. */
function bodyKeyFor(file: UnavailableFile | null): TranslationKey {
  switch (file?.reason) {
    case 'too-large':
      return 'workspace.fileUnavailable.tooLargeBody'
    case 'outside-workspace':
      // A path the server will not serve cannot be saved either, so it says that
      // instead of offering a download that is certain to fail.
      return file.canDownload
        ? 'workspace.fileUnavailable.outsideBody'
        : 'workspace.fileUnavailable.unreachableBody'
    default:
      return 'workspace.fileUnavailable.body'
  }
}

function bodyVarsFor(file: UnavailableFile | null): Record<string, string> {
  const vars: Record<string, string> = { name: file?.name ?? '' }
  if (file?.reason === 'too-large' && typeof file.size === 'number') {
    vars.size = formatBytes(file.size)
  }
  return vars
}
