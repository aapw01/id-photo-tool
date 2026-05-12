'use client'

/**
 * The Studio workspace shell. Composes:
 *
 *   - The Studio store (current file + bitmap + mask)
 *   - useSegmentation (runs MODNet on the staged bitmap)
 *   - StudioPreview (renders original | mask preview)
 *   - SegmentationFeedback (progress strip + error toasts)
 *   - UploadDropzone for the empty-state and "replace photo" flow
 *
 * Drives segmentation automatically when a new bitmap is staged.
 * Subsequent re-runs are explicit (the retry button).
 */

import { useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

import { UploadDropzone } from '@/components/upload-dropzone'
import { Button } from '@/components/ui/button'
import { SegmentationFeedback } from '@/features/segmentation/segmentation-feedback'
import { useSegmentation } from '@/features/segmentation/use-segmentation'

import { useStudioStore } from './store'
import { StudioPreview } from './studio-preview'

export function StudioWorkspace() {
  const t = useTranslations('Studio')
  const tActions = useTranslations('Studio.actions')

  const file = useStudioStore((s) => s.file)
  const bitmap = useStudioStore((s) => s.bitmap)
  const mask = useStudioStore((s) => s.mask)
  const lastInference = useStudioStore((s) => s.lastInference)
  const setMask = useStudioStore((s) => s.setMask)
  const setFile = useStudioStore((s) => s.setFile)

  const { segment, state, error } = useSegmentation()

  const runSegmentation = useCallback(async () => {
    const currentFile = useStudioStore.getState().file
    if (!currentFile) return
    try {
      // ImageBitmap is transferable and gets detached on postMessage,
      // so always hand the worker a freshly decoded copy. The studio
      // store's bitmap stays alive for preview.
      const fresh = await createImageBitmap(currentFile, { imageOrientation: 'from-image' })
      const result = await segment(fresh)
      setMask(result.mask, result)
    } catch {
      // SegmentationFeedback handles surfacing the error via toast.
    }
  }, [segment, setMask])

  // Auto-run segmentation when a fresh bitmap is staged (no mask yet).
  // Track the last bitmap we ran to avoid double-firing on re-renders.
  const lastRun = useRef<ImageBitmap | null>(null)
  useEffect(() => {
    if (!bitmap || mask) return
    if (lastRun.current === bitmap) return
    lastRun.current = bitmap
    void runSegmentation()
  }, [bitmap, mask, runSegmentation])

  const onReset = useCallback(() => {
    void setFile(null)
  }, [setFile])

  if (!bitmap) {
    return (
      <div className="space-y-4">
        <UploadDropzone />
        <p className="text-center text-sm text-[var(--color-text-weak)]">{t('empty.subtitle')}</p>
        <SegmentationFeedback />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <StudioPreview bitmap={bitmap} mask={mask} />
      <aside className="space-y-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {file?.name ?? 'image'}
              </p>
            </div>
            <p className="font-mono text-xs text-[var(--color-text-mute)]">
              {t('stats.size', { w: bitmap.width, h: bitmap.height })}
            </p>
            {lastInference ? (
              <p className="font-mono text-xs text-[var(--color-text-mute)]">
                {t('stats.inference', {
                  backend: lastInference.backend,
                  ms: lastInference.durationMs,
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onReset} variant="outline">
            {tActions('replace')}
          </Button>
          <Button
            onClick={() => runSegmentation()}
            disabled={state === 'loading-model' || state === 'inferring'}
            variant="ghost"
          >
            {tActions('retry')}
          </Button>
          <DownloadPngButton bitmap={bitmap} mask={mask} disabled={!mask || !!error}>
            {tActions('downloadPng')}
          </DownloadPngButton>
        </div>
      </aside>
      <SegmentationFeedback />
    </div>
  )
}

interface DownloadPngButtonProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  disabled?: boolean
  children: React.ReactNode
}

/**
 * Composite the original RGB with the mask's alpha into a single
 * transparent PNG and trigger a download. Runs entirely client-side.
 */
function DownloadPngButton({ bitmap, mask, disabled, children }: DownloadPngButtonProps) {
  const handleClick = useCallback(() => {
    if (!mask) return
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    // 1. Paint the original RGB.
    ctx.drawImage(bitmap, 0, 0)

    // 2. Pull pixels, multiply the original's alpha by the mask alpha.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    const maskPixels = mask.data
    const n = pixels.length
    for (let i = 0, j = 3; i < n; i += 4, j += 4) {
      // Mask is RGBA where A carries the cutout. Multiply, not replace,
      // so an already-transparent input pixel stays transparent.
      const origAlpha = pixels[i + 3] ?? 0
      const maskAlpha = maskPixels[j] ?? 0
      pixels[i + 3] = Math.round((origAlpha * maskAlpha) / 255)
    }
    ctx.putImageData(imageData, 0, 0)

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pixfit-cutout-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [bitmap, mask])

  return (
    <Button onClick={handleClick} disabled={disabled}>
      {children}
    </Button>
  )
}
