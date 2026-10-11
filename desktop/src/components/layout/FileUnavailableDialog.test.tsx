import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { FileUnavailableDialog } from './FileUnavailableDialog'

const download = vi.hoisted(() => vi.fn())
vi.mock('@/lib/handlePreviewLink', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/handlePreviewLink')>()),
  downloadLocalFile: download,
}))

beforeEach(() => {
  useSettingsStore.setState({ locale: 'en' })
  download.mockReset()
  useUIStore.setState({ unavailableFile: null })
})

describe('FileUnavailableDialog', () => {
  it('stays out of the way until there is something to explain', () => {
    render(<FileUnavailableDialog />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names the file and offers the save that still gets it onto the device', () => {
    useUIStore.setState({
      unavailableFile: {
        absolutePath: '/w/out/launch.pptx',
        name: 'launch.pptx',
        reason: 'no-viewer',
        canDownload: true,
      },
    })
    render(<FileUnavailableDialog />)

    expect(screen.getByRole('dialog', { name: 'Can’t open in the page' })).toBeInTheDocument()
    expect(screen.getByText(/launch\.pptx/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    expect(download).toHaveBeenCalledWith('/w/out/launch.pptx')
    // Dismissed from the same action that saved it: an open dialog over a file
    // the user already dealt with is just in the way.
    expect(useUIStore.getState().unavailableFile).toBeNull()
  })

  it('closes without saving', () => {
    useUIStore.setState({
      unavailableFile: {
        absolutePath: '/w/a.zip',
        name: 'a.zip',
        reason: 'no-viewer',
        canDownload: true,
      },
    })
    render(<FileUnavailableDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(download).not.toHaveBeenCalled()
    expect(useUIStore.getState().unavailableFile).toBeNull()
  })

  it('gives the size when the file was too large, not a bare refusal', () => {
    useUIStore.setState({
      unavailableFile: {
        absolutePath: '/w/huge.bin',
        name: 'huge.bin',
        reason: 'too-large',
        size: 24 * 1024 * 1024,
        canDownload: true,
      },
    })
    render(<FileUnavailableDialog />)

    expect(screen.getByText(/24 MB/)).toBeInTheDocument()
  })

  it('says a file is outside the workspace rather than that nothing can draw it', () => {
    useUIStore.setState({
      unavailableFile: {
        absolutePath: '/elsewhere/notes.md',
        name: 'notes.md',
        reason: 'outside-workspace',
        canDownload: true,
      },
    })
    render(<FileUnavailableDialog />)

    expect(screen.getByText(/outside the workspace/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  })

  it('offers no save for a path the server cannot serve, since it could only fail', () => {
    useUIStore.setState({
      unavailableFile: {
        absolutePath: '/var/secret.txt',
        name: 'secret.txt',
        reason: 'outside-workspace',
        canDownload: false,
      },
    })
    render(<FileUnavailableDialog />)

    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
