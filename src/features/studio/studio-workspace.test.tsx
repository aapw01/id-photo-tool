import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCropStore, __resetCropStoreForTesting } from '@/features/crop/spec-store'
import { useLayoutStore } from '@/features/layout'

import { useStudioStore } from './store'
import { StudioWorkspace } from './studio-workspace'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  segment: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const messages: Record<string, string> = {
      'Studio.actions.replace': 'Replace photo',
      'Studio.actions.retry': 'Run again',
      'Studio.empty.subtitle': 'Upload a photo to start',
      'Studio.mobile.panelSummary': 'Panel summary',
      'Studio.stats.size': 'Size',
      'Studio.tabs.background': 'Background',
      'Home.uploadDropzone.title': 'Drop a photo here, or click to choose',
      'Home.uploadDropzone.subtitle': 'JPG / PNG / HEIC',
      'Home.uploadDropzone.browse': 'Choose photo',
    }

    return (key: string) => messages[namespace ? `${namespace}.${key}` : key] ?? key
  },
}))

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('./tab-deeplink', () => ({
  useTabDeeplink: () => undefined,
}))

vi.mock('@/features/crop/use-crop-flow', () => ({
  useCropFlow: () => undefined,
}))

vi.mock('@/features/segmentation/use-segmentation', () => ({
  useSegmentation: () => ({
    segment: mocks.segment,
    state: 'idle',
    error: null,
  }),
}))

vi.mock('@/features/segmentation/segmentation-feedback', () => ({
  SegmentationFeedback: () => <div data-testid="segmentation-feedback" />,
}))

vi.mock('@/features/background/background-panel', () => ({
  BackgroundPanel: () => <div data-testid="background-panel" />,
}))

vi.mock('@/features/background/export-panel', () => ({
  ExportPanel: () => <div data-testid="export-panel" />,
}))

vi.mock('@/features/crop/compliance-banner', () => ({
  ComplianceBanner: () => <div data-testid="compliance-banner" />,
}))

vi.mock('@/features/crop/crop-frame', () => ({
  CropFrameOverlay: () => <div data-testid="crop-frame-overlay" />,
}))

vi.mock('@/features/crop/guidelines', () => ({
  Guidelines: () => <div data-testid="guidelines" />,
}))

vi.mock('@/features/crop/spec-picker', () => ({
  SpecPicker: () => <div data-testid="spec-picker" />,
}))

vi.mock('@/features/layout', async () => {
  const actual = await vi.importActual<typeof import('@/features/layout')>('@/features/layout')
  return {
    ...actual,
    LayoutPanel: () => <div data-testid="layout-panel" />,
    LayoutPreview: () => <div data-testid="layout-preview" />,
  }
})

vi.mock('./studio-bottom-tabs', () => ({
  StudioBottomTabs: () => <div data-testid="studio-bottom-tabs" />,
}))

vi.mock('./studio-preview', () => ({
  StudioPreview: () => <div data-testid="studio-preview" />,
}))

function makeBitmap(width = 200, height = 300): ImageBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap
}

function makeImageData(width = 1, height = 1): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData
}

function stagePhoto() {
  const file = new File(['old'], 'old.png', { type: 'image/png' })
  const bitmap = makeBitmap()
  useStudioStore.setState({
    file,
    bitmap,
    mask: null,
    lastInference: null,
  })
  return { file, bitmap }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetCropStoreForTesting()
  useLayoutStore.getState().reset()
  useStudioStore.setState({
    file: null,
    bitmap: null,
    mask: null,
    lastInference: null,
  })
  Object.defineProperty(globalThis, 'createImageBitmap', {
    value: vi.fn(async () => makeBitmap(640, 480)),
    configurable: true,
  })
})

describe('StudioWorkspace photo replacement', () => {
  it('keeps the current Studio photo visible when replace is clicked', async () => {
    const { bitmap } = stagePhoto()
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined)

    render(<StudioWorkspace />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Replace photo' })[0]!)

    expect(inputClick).toHaveBeenCalledTimes(1)
    expect(mocks.routerPush).not.toHaveBeenCalled()
    expect(bitmap.close).not.toHaveBeenCalled()
    expect(screen.getByTestId('studio-preview')).toBeInTheDocument()
    expect(screen.queryByText('Drop a photo here, or click to choose')).not.toBeInTheDocument()

    inputClick.mockRestore()
  })

  it('replaces the photo, drops photo-bound state, but keeps the user task choices', async () => {
    // Photo-bound state (mask, crop frame, face) must drop because it's
    // tied to *this* image's pixels. Task-bound state (the chosen size
    // spec, paper / layout / margin settings, background colour) must
    // survive because retaking the same shot doesn't change what the
    // user wants to produce — re-asking for every preference is the
    // single biggest UX regression we want to avoid here.
    const { bitmap } = stagePhoto()
    const newFile = new File(['new'], 'new.png', { type: 'image/png' })
    const mask = makeImageData()
    useStudioStore.getState().setMask(mask, {
      backend: 'wasm',
      durationMs: 12,
      mask,
    })
    useCropStore.getState().setFrame({ x: 1, y: 2, w: 3, h: 4 })
    useCropStore.getState().setSpec({
      id: 'test-spec',
      name: 'test',
      category: 'custom',
      width_mm: 25,
      height_mm: 35,
      dpi: 300,
    })
    useLayoutStore.getState().setSettings({ margin_mm: 99 })

    render(<StudioWorkspace />)

    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInstanceOf(HTMLInputElement)

    fireEvent.change(input!, { target: { files: [newFile] } })

    await waitFor(() => expect(useStudioStore.getState().file).toBe(newFile))
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(useStudioStore.getState().mask).toBeNull()
    expect(useStudioStore.getState().lastInference).toBeNull()
    expect(useCropStore.getState().frame).toBeNull()
    // Spec + layout settings *survive* the photo swap.
    expect(useCropStore.getState().spec?.id).toBe('test-spec')
    expect(useLayoutStore.getState().settings.margin_mm).toBe(99)
    expect(mocks.segment).not.toHaveBeenCalled()
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })

  it('leaves the current photo untouched when the file picker is cancelled', () => {
    const { file, bitmap } = stagePhoto()

    render(<StudioWorkspace />)

    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInstanceOf(HTMLInputElement)

    fireEvent.change(input!, { target: { files: [] } })

    expect(useStudioStore.getState().file).toBe(file)
    expect(useStudioStore.getState().bitmap).toBe(bitmap)
    expect(bitmap.close).not.toHaveBeenCalled()
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })
})
