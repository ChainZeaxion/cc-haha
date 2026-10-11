import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.hoisted(() => vi.fn())
const getWorkspaceFile = vi.hoisted(() => vi.fn())
const fileSpy = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({ api: { get: apiGet } }))
vi.mock('@/api/sessions', () => ({ sessionsApi: { getWorkspaceFile } }))
vi.mock('./workspace/openTarget', () => ({
  workspaceOpen: { file: fileSpy, browser: vi.fn(), review: vi.fn(), terminal: vi.fn() },
}))

import { MAX_IMAGE_PREVIEW_BYTES, openFileOutsideWorkspace } from './openOutsideWorkspaceFile'
import { useUIStore } from '@/stores/uiStore'

const info = (size: number) => ({ name: 'notes.md', size, mime: 'text/markdown' })
const unavailable = () => useUIStore.getState().unavailableFile
const settle = () => vi.waitFor(() => {
  if (unavailable() === null && fileSpy.mock.calls.length === 0) throw new Error('still deciding')
})

beforeEach(() => {
  vi.clearAllMocks()
  useUIStore.setState({ unavailableFile: null })
  getWorkspaceFile.mockResolvedValue({ state: 'ok' })
})

describe('openFileOutsideWorkspace', () => {
  it('asks the server for the size before anything is transferred', async () => {
    apiGet.mockResolvedValue(info(1024))
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/elsewhere/notes.md', displayPath: '/elsewhere/notes.md' })
    await settle()

    expect(apiGet).toHaveBeenCalledWith('/local-file/elsewhere/notes.md?info=1')
  })

  it('shows a small text file in the workspace', async () => {
    apiGet.mockResolvedValue(info(1024))
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/elsewhere/notes.md', displayPath: '/elsewhere/notes.md' })
    await settle()

    expect(fileSpy).toHaveBeenCalledWith('s1', '/elsewhere/notes.md', { requestedBy: 'user' })
    expect(unavailable()).toBeNull()
  })

  it('refuses an image past the size limit, saying how big it is, and still saves it', async () => {
    const size = MAX_IMAGE_PREVIEW_BYTES + 1
    apiGet.mockResolvedValue({ name: 'shot.png', size, mime: 'image/png' })
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/elsewhere/shot.png', displayPath: '/elsewhere/shot.png' })
    await settle()

    expect(fileSpy).not.toHaveBeenCalled()
    expect(unavailable()).toMatchObject({ reason: 'too-large', size, canDownload: true })
    // The size probe is the only request: nothing was read.
    expect(getWorkspaceFile).not.toHaveBeenCalled()
  })

  it('opens a large text file anyway, since the server sends its head to be read', async () => {
    // The ceiling is about what has to be carried whole. Text is truncated
    // instead, so a big one still opens — sized well past the image limit on
    // purpose, to pin that the two are not the same rule.
    apiGet.mockResolvedValue({ name: 'server.log', size: 64 * 1024 * 1024, mime: 'text/plain' })
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/elsewhere/server.log', displayPath: '/elsewhere/server.log' })
    await settle()

    expect(fileSpy).toHaveBeenCalledWith('s1', '/elsewhere/server.log', { requestedBy: 'user' })
    expect(unavailable()).toBeNull()
  })

  it('does not open a tab the workspace route would refuse', async () => {
    apiGet.mockResolvedValue(info(1024))
    getWorkspaceFile.mockRejectedValue(new Error('403 Path is outside workspace'))
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/elsewhere/notes.md', displayPath: '/elsewhere/notes.md' })
    await settle()

    expect(fileSpy).not.toHaveBeenCalled()
    expect(unavailable()).toMatchObject({ reason: 'outside-workspace', canDownload: true })
  })

  it('offers no save when the server will not serve the path at all', async () => {
    apiGet.mockRejectedValue(new Error('403 forbidden'))
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/var/secret.txt', displayPath: '/var/secret.txt' })
    await settle()

    // Both the preview and the download go through the server, so neither can work.
    expect(unavailable()).toMatchObject({ reason: 'outside-workspace', canDownload: false })
  })

  it('skips the workspace-route question for media, which is served by the other route', async () => {
    apiGet.mockResolvedValue({ name: 'clip.mp4', size: 2048, mime: 'video/mp4' })
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/elsewhere/clip.mp4', displayPath: '/elsewhere/clip.mp4' })
    await settle()

    expect(fileSpy).toHaveBeenCalledWith('s1', '/elsewhere/clip.mp4', { requestedBy: 'user' })
    expect(getWorkspaceFile).not.toHaveBeenCalled()
  })

  it('names the reason a small file cannot be drawn here, keeping the save', async () => {
    apiGet.mockResolvedValue({ name: 'deck.pptx', size: 4096, mime: 'application/vnd.ms-powerpoint' })
    openFileOutsideWorkspace({ sessionId: 's1', absolutePath: '/elsewhere/deck.pptx', displayPath: '/elsewhere/deck.pptx' })
    await settle()

    expect(fileSpy).not.toHaveBeenCalled()
    expect(unavailable()).toMatchObject({ reason: 'no-viewer', canDownload: true })
  })

  it('keeps the chat origin so the conversation can scroll back', async () => {
    apiGet.mockResolvedValue(info(1024))
    const origin = { sourceTurnKey: 'turn-1', sourceElementId: 'el-1' }
    openFileOutsideWorkspace({
      sessionId: 's1',
      absolutePath: '/elsewhere/notes.md',
      displayPath: '/elsewhere/notes.md',
      origin,
    })
    await settle()

    expect(fileSpy).toHaveBeenCalledWith('s1', '/elsewhere/notes.md', { origin, requestedBy: 'user' })
  })
})
