import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  shellAvailable: true,
  openPath: vi.fn(),
  listForPath: vi.fn(),
  openTarget: vi.fn(),
}))

vi.mock('./desktopHost', () => ({
  getDesktopHost: () => ({
    capabilities: { shell: mocks.shellAvailable },
    shell: { openPath: mocks.openPath },
  }),
}))

vi.mock('../api/openTargets', () => ({
  openTargetsApi: {
    listForPath: mocks.listForPath,
    open: mocks.openTarget,
  },
}))

import {
  SystemOpenUnavailableError,
  canOpenWithSystem,
  openFileWithSystemOrOfferSave,
  openLocalFileWithSystem,
  resolveAbsoluteOpenPath,
} from './systemFileOpen'
import { useUIStore } from '../stores/uiStore'

describe('systemFileOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.shellAvailable = true
    mocks.openPath.mockResolvedValue(undefined)
    useUIStore.setState({ unavailableFile: null, toasts: [] })
  })

  it('resolves relative files against the session work directory', () => {
    expect(resolveAbsoluteOpenPath('reports/brief.docx', '/work/project')).toBe('/work/project/reports/brief.docx')
    expect(resolveAbsoluteOpenPath('/tmp/brief.docx', '/work/project')).toBe('/tmp/brief.docx')
  })

  it('preserves a Windows UNC target without treating it as workspace-relative', () => {
    expect(resolveAbsoluteOpenPath('\\\\server\\share\\brief.docx', 'C:/repo')).toBe('\\\\server\\share\\brief.docx')
  })

  it('uses the guarded Electron shell bridge when available', async () => {
    await openLocalFileWithSystem('/tmp/brief.docx')

    expect(mocks.openPath).toHaveBeenCalledWith('/tmp/brief.docx')
    expect(mocks.listForPath).not.toHaveBeenCalled()
  })

  it('falls back to the validated server system target outside Electron', async () => {
    mocks.openPath.mockRejectedValue(new Error('desktop unavailable'))
    mocks.listForPath.mockResolvedValue({
      targets: [{ id: 'system-default', kind: 'system_default' }],
    })
    mocks.openTarget.mockResolvedValue({ ok: true })

    await openLocalFileWithSystem('/tmp/brief.docx')

    expect(mocks.listForPath).toHaveBeenCalledWith('/tmp/brief.docx')
    expect(mocks.openTarget).toHaveBeenCalledWith('system-default', '/tmp/brief.docx')
  })

  describe('a runtime with no system shell (browser / H5)', () => {
    beforeEach(() => {
      mocks.shellAvailable = false
    })

    it('reports the capability honestly', () => {
      expect(canOpenWithSystem()).toBe(false)
    })

    it('refuses instead of launching the file on the server', async () => {
      // The server fallback is what opened the file in the *server's* desktop
      // session — the machine the user is not looking at.
      await expect(openLocalFileWithSystem('/w/song.mp3')).rejects.toBeInstanceOf(SystemOpenUnavailableError)
      expect(mocks.listForPath).not.toHaveBeenCalled()
      expect(mocks.openTarget).not.toHaveBeenCalled()
      expect(mocks.openPath).not.toHaveBeenCalled()
    })

    it('answers an open click with the save dialog rather than an error naming the file', async () => {
      openFileWithSystemOrOfferSave('/w/out/launch.pptx')
      await vi.waitFor(() => expect(useUIStore.getState().unavailableFile).not.toBeNull())

      expect(useUIStore.getState().unavailableFile).toEqual({
        absolutePath: '/w/out/launch.pptx',
        name: 'launch.pptx',
        reason: 'no-viewer',
        canDownload: true,
      })
      expect(useUIStore.getState().toasts).toHaveLength(0)
    })
  })

  it('reports a genuine failure by name, with the toast the user can act on', async () => {
    mocks.openPath.mockRejectedValue(new Error('no application'))
    mocks.listForPath.mockRejectedValue(new Error('server refused'))

    openFileWithSystemOrOfferSave('/w/out/thesis.pdf')
    await vi.waitFor(() => expect(useUIStore.getState().toasts).toHaveLength(1))

    expect(useUIStore.getState().unavailableFile).toBeNull()
  })
})
