import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'
import { MediaSurface } from './MediaSurface'

vi.mock('@/lib/desktopRuntime', () => ({
  getServerBaseUrl: () => 'http://127.0.0.1:4321',
}))

// Defaults to the browser host, which is where the media element matters most:
// it is the only way the file plays on the device at all.
const shell = vi.hoisted(() => ({ available: false }))
vi.mock('@/lib/systemFileOpen', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/systemFileOpen')>()),
  canOpenWithSystem: () => shell.available,
}))

beforeEach(() => {
  useSettingsStore.setState({ locale: 'en' })
  shell.available = false
})

describe('MediaSurface', () => {
  it('plays a video with the browser element, from a URL that can seek', () => {
    render(<MediaSurface sessionId="s1" path="clip.mp4" absolutePath="/w/clip.mp4" />)

    const video = screen.getByTestId('workspace-media-video')
    // The filesystem route, not the `raw` document route: only this one streams
    // with range support, without which a video cannot be seeked or scrubbed.
    expect(video).toHaveAttribute('src', 'http://127.0.0.1:4321/local-file/w/clip.mp4')
    expect(video).toHaveAttribute('controls')
  })

  it('plays audio with the audio element', () => {
    render(<MediaSurface sessionId="s1" path="voice.mp3" absolutePath="/w/voice.mp3" />)

    expect(screen.getByTestId('workspace-media-audio')).toHaveAttribute(
      'src',
      'http://127.0.0.1:4321/local-file/w/voice.mp3',
    )
  })

  it('falls back to the session route when the path could not be rooted', () => {
    // `workDir` has not loaded, so `absolutePath` is still the relative path: a
    // `/local-file` URL built from it would name a file that is not there.
    render(<MediaSurface sessionId="s1" path="out/clip.mp4" absolutePath="out/clip.mp4" />)

    expect(screen.getByTestId('workspace-media-video')).toHaveAttribute(
      'src',
      'http://127.0.0.1:4321/preview-fs/s1/out/clip.mp4',
    )
  })

  it('replaces a container the browser cannot decode with a way out', () => {
    render(<MediaSurface sessionId="s1" path="film.mkv" absolutePath="/w/film.mkv" />)

    fireEvent.error(screen.getByTestId('workspace-media-video'))

    expect(screen.queryByTestId('workspace-media-video')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('This media can’t be played here.')
    // No system player exists on this runtime, so the way out is the save.
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  })

  it('offers the system player for an undecodable container on the desktop', () => {
    shell.available = true
    render(<MediaSurface sessionId="s1" path="film.mkv" absolutePath="/w/film.mkv" />)

    fireEvent.error(screen.getByTestId('workspace-media-video'))

    expect(screen.getByRole('button', { name: 'Open in system app' })).toBeInTheDocument()
  })
})
