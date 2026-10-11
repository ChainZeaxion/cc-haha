import { useState } from 'react'
import { useTranslation } from '@/i18n'
import { getServerBaseUrl } from '@/lib/desktopRuntime'
import { isRootedLocalPath, localFileUrl, previewFsUrl } from '@/lib/handlePreviewLink'
import { isWorkspaceVideoFile } from '@/lib/fileCapabilities'
import { OpenInSystemButton } from './OpenInSystemButton'
import { PanelMessage } from './PanelMessage'

/**
 * The workspace's player for audio and video.
 *
 * Media is the one file kind the document viewers cannot cover. They read through
 * the `raw` route, which serves whole documents and cannot seek — and a video that
 * cannot seek is not playable — so this uses the filesystem routes, which stream
 * with range support and let the browser's own element seek.
 *
 * The element gets a bare URL because an `<audio>`/`<video src>` cannot carry an
 * Authorization header. That is also why media is the one preview the H5 surface
 * plays *on the phone*: there, the same-origin subresource rule authorizes exactly
 * these loads, and there is no system player to hand the file to instead.
 *
 * A container the browser cannot decode (`.mkv`, `.avi`) lands in the failure
 * state rather than a broken element, which offers the system player on the
 * desktop and a save everywhere else — see `OpenInSystemButton`.
 */
export function MediaSurface({
  sessionId,
  path,
  absolutePath,
}: {
  sessionId: string
  path: string
  absolutePath: string
}) {
  const t = useTranslation()
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <PanelMessage
        icon="movie"
        message={t('workspace.mediaUnavailable')}
        action={<OpenInSystemButton absolutePath={absolutePath} />}
      />
    )
  }

  const base = getServerBaseUrl()
  // A path the workspace could root goes through the session-scoped route; one it
  // could not (`workDir` has not loaded yet) would build a nonsense `/local-file`
  // URL, so it keeps the relative form the preview route resolves server-side.
  const src = isRootedLocalPath(absolutePath)
    ? localFileUrl(base, absolutePath)
    : previewFsUrl(base, sessionId, path)
  const onError = () => setFailed(true)

  if (isWorkspaceVideoFile(path)) {
    return (
      <video
        data-testid="workspace-media-video"
        src={src}
        controls
        preload="metadata"
        playsInline
        onError={onError}
        className="max-h-full w-full bg-black"
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <audio
        data-testid="workspace-media-audio"
        src={src}
        controls
        preload="metadata"
        onError={onError}
        className="w-full max-w-[520px]"
      />
    </div>
  )
}
