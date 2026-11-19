import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { trackEvent } from '@/lib/analytics'
import { triggerDownload } from '@/features/export'
import { canvasToBlob } from '@/features/export/export-single'

import { LayoutActions } from './layout-actions'
import { useLayoutStore } from './store'
import { exportLayoutPdf } from './export-pdf'
import { renderLayout } from './render-layout'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/features/export', () => ({
  buildFilename: ({ ext }: { ext: string }) => `layout.${ext}`,
  triggerDownload: vi.fn(),
}))
vi.mock('@/features/export/export-single', () => ({ canvasToBlob: vi.fn() }))
vi.mock('./render-layout', () => ({ renderLayout: vi.fn() }))
vi.mock('./export-pdf', () => ({ exportLayoutPdf: vi.fn() }))

const image = { width: 600, height: 800 } as ImageBitmap
const blob = new Blob(['layout'])

beforeEach(() => {
  vi.clearAllMocks()
  useLayoutStore.getState().reset()
  useLayoutStore.getState().setTemplate({
    ...useLayoutStore.getState().template,
    items: [],
  })
  vi.mocked(renderLayout).mockReturnValue({
    canvas: document.createElement('canvas'),
    placed: [],
    overflow: [],
  })
  vi.mocked(canvasToBlob).mockResolvedValue(blob)
  vi.mocked(exportLayoutPdf).mockResolvedValue({ blob, placedCount: 0, overflow: [] })
})

function mount() {
  render(
    <LayoutActions
      bitmap={image}
      mask={null}
      bg={{ kind: 'color', hex: '#ffffff' }}
      activeCropSpec={null}
      activeCropFrame={null}
    />,
  )
}

describe('layout download analytics', () => {
  it.each(['png', 'pdf'] as const)('records a completed %s download once', async (format) => {
    mount()
    await screen.findByText(`layout.${format}`)
    fireEvent.click(screen.getByRole('button', { name: format }))

    await waitFor(() => expect(triggerDownload).toHaveBeenCalledWith(blob, `layout.${format}`))
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('export_succeeded', {
      surface: 'layout',
      destination: 'download',
      format,
    })
  })

  it.each(['png', 'pdf'] as const)('does not record a failed %s download', async (format) => {
    vi.mocked(triggerDownload).mockImplementation(() => {
      throw new Error('Download failed')
    })
    mount()
    await screen.findByText(`layout.${format}`)
    fireEvent.click(screen.getByRole('button', { name: format }))

    await waitFor(() => expect(triggerDownload).toHaveBeenCalledOnce())
    expect(trackEvent).not.toHaveBeenCalled()
  })
})
