import { Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSystemFileAction } from '@/hooks/useSystemFileAction'

/**
 * The way out of every state the workspace cannot render — too large, damaged,
 * a format it has no viewer for.
 *
 * Which way out depends on the runtime, and only on the runtime: with a system
 * shell the file goes to its default application, and without one the button
 * becomes the save that does get the user the file. See `useSystemFileAction`.
 */
export function OpenInSystemButton({ absolutePath }: { absolutePath: string }) {
  const action = useSystemFileAction(absolutePath)

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={action.canOpen
        ? <ExternalLink size={14} strokeWidth={1.9} aria-hidden="true" />
        : <Download size={14} strokeWidth={1.9} aria-hidden="true" />}
      onClick={action.run}
    >
      {action.label}
    </Button>
  )
}
