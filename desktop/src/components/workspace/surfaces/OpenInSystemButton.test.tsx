import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'
import { OpenInSystemButton } from './OpenInSystemButton'

const fixture = vi.hoisted(() => ({
  shell: true,
  openFileWithSystemOrOfferSave: vi.fn(),
  downloadLocalFile: vi.fn(),
}))

vi.mock('@/lib/systemFileOpen', () => ({
  canOpenWithSystem: () => fixture.shell,
  openFileWithSystemOrOfferSave: fixture.openFileWithSystemOrOfferSave,
}))
vi.mock('@/lib/handlePreviewLink', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/handlePreviewLink')>()),
  downloadLocalFile: fixture.downloadLocalFile,
}))

beforeEach(() => {
  useSettingsStore.setState({ locale: 'en' })
  fixture.shell = true
  fixture.openFileWithSystemOrOfferSave.mockReset()
  fixture.downloadLocalFile.mockReset()
})

describe('OpenInSystemButton', () => {
  it('is named for what it does, in the reader’s language', () => {
    render(<OpenInSystemButton absolutePath="/work/out/thesis.pdf" />)

    expect(screen.getByRole('button', { name: 'Open in system app' })).toBeInTheDocument()
  })

  it('hands the file to the operating system', () => {
    render(<OpenInSystemButton absolutePath="/work/out/thesis.pdf" />)

    fireEvent.click(screen.getByRole('button'))

    expect(fixture.openFileWithSystemOrOfferSave).toHaveBeenCalledWith('/work/out/thesis.pdf')
  })

  // The failure reporting and the save dialog belong to the shared opener, which
  // has its own suite. What is asserted here is only that this button asks for it.
  it('becomes the save where there is no system shell, instead of promising an open it cannot do', () => {
    fixture.shell = false
    render(<OpenInSystemButton absolutePath="/work/out/thesis.pdf" />)

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    expect(fixture.downloadLocalFile).toHaveBeenCalledWith('/work/out/thesis.pdf')
    expect(fixture.openFileWithSystemOrOfferSave).not.toHaveBeenCalled()
  })
})
