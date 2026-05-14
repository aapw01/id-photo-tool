import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScannerPreviewDialog } from './scanner-preview-dialog'
import type { ScannerSlot } from '../store'
import { useScannerStore } from '../store'

/**
 * Component-level smoke test for the new preview dialog.
 *
 * The store-level regeneration logic is covered by `store.test.ts`;
 * here we only verify the UI surface:
 *
 *   1. Trigger button respects `canPreview` (disabled when no
 *      rectified side).
 *   2. Opening the dialog kicks off a `regeneratePreview` call AND
 *      renders the packed-sheet image when it resolves.
 *   3. ESC / overlay click closes the dialog (Radix primitive does
 *      the heavy lifting; we trust the integration test confirms
 *      that the dialog actually goes away).
 *   4. The Download PDF / PNG footer buttons trigger the existing
 *      export actions on the store, NOT a different pipeline. This
 *      is the parity contract — we just spy on the store actions
 *      to assert they are called rather than verifying the bytes,
 *      which is the job of the pack-a4 / export-pdf kernel suites.
 */

// Anchor-click triggers a real navigation in happy-dom; intercept the
// download anchor that the dialog injects so the test stays in-page.
const originalClick = HTMLAnchorElement.prototype.click

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, vars?: Record<string, string>) => {
      const path = namespace ? `${namespace}.${key}` : key
      if (vars && Object.keys(vars).length > 0) {
        let out = path
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(`{${k}}`, String(v))
        }
        return out
      }
      return path
    }
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function installFrontSlot(): void {
  const slot: ScannerSlot = {
    file: new File([new Blob([new Uint8Array([1])])], 'test.png', { type: 'image/png' }),
    bitmap: {} as unknown as ImageBitmap,
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    convertedFromHeic: false,
    convertedFromPdf: false,
    sourcePageCount: undefined,
    rectified: {
      blob: new Blob([new Uint8Array([2])], { type: 'image/png' }),
      quad: {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 100, y: 0 },
        bottomRight: { x: 100, y: 100 },
        bottomLeft: { x: 0, y: 100 },
      },
      width: 100,
      height: 100,
      userAdjusted: false,
    },
    rectifyState: 'ready',
    rectifyError: null,
    rendered: null,
    renderState: 'idle',
  }
  useScannerStore.setState({ front: slot })
}

describe('ScannerPreviewDialog', () => {
  let urlCounter = 0

  beforeEach(() => {
    useScannerStore.getState().reset()
    urlCounter = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++urlCounter}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    HTMLAnchorElement.prototype.click = originalClick
  })

  it('disables the trigger when canPreview is false', () => {
    render(<ScannerPreviewDialog canPreview={false} />)
    const trigger = screen.getByRole('button', { name: /Scanner\.preview\.trigger/ })
    expect(trigger).toBeDisabled()
  })

  it('enables the trigger when canPreview is true', () => {
    installFrontSlot()
    render(<ScannerPreviewDialog canPreview />)
    const trigger = screen.getByRole('button', { name: /Scanner\.preview\.trigger/ })
    expect(trigger).not.toBeDisabled()
  })

  it('opens the dialog on trigger click and runs regeneratePreview', async () => {
    installFrontSlot()
    const regenSpy = vi.spyOn(useScannerStore.getState(), 'regeneratePreview')
    render(<ScannerPreviewDialog canPreview />)
    fireEvent.click(screen.getByRole('button', { name: /Scanner\.preview\.trigger/ }))
    // Dialog title becomes visible.
    await waitFor(() => {
      expect(screen.getByText('Scanner.preview.title')).toBeInTheDocument()
    })
    expect(regenSpy).toHaveBeenCalled()
  })

  it('renders the packed-sheet image once the preview is ready', async () => {
    installFrontSlot()
    render(<ScannerPreviewDialog canPreview />)
    fireEvent.click(screen.getByRole('button', { name: /Scanner\.preview\.trigger/ }))
    await waitFor(() => {
      const img = screen.getByRole('img', { name: /Scanner\.preview\.imageAlt/ })
      expect(img).toBeInTheDocument()
      expect(img.getAttribute('src')).toMatch(/^blob:test-/)
    })
  })

  it('routes Download PDF / PNG clicks through the store export actions', async () => {
    installFrontSlot()
    const exportPdf = vi
      .spyOn(useScannerStore.getState(), 'exportPdfBlob')
      .mockResolvedValue(new Blob([new Uint8Array([3])], { type: 'application/pdf' }))
    const exportPng = vi
      .spyOn(useScannerStore.getState(), 'exportA4PngBlob')
      .mockResolvedValue(new Blob([new Uint8Array([4])], { type: 'image/png' }))

    render(<ScannerPreviewDialog canPreview />)
    fireEvent.click(screen.getByRole('button', { name: /Scanner\.preview\.trigger/ }))
    await waitFor(() => screen.getByText('Scanner.preview.title'))

    // The footer hosts both buttons; click each and verify the
    // matching store action fires (and only the matching one).
    fireEvent.click(screen.getByRole('button', { name: /Scanner\.export\.png/ }))
    await waitFor(() => {
      expect(exportPng).toHaveBeenCalled()
    })
    expect(exportPdf).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Scanner\.export\.pdf/ }))
    await waitFor(() => {
      expect(exportPdf).toHaveBeenCalled()
    })
  })
})
