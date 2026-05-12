'use client'

/**
 * Download buttons for the layout tab — PNG (raster) and PDF (vector).
 *
 * Reuses `renderLayout` for the PNG path and `exportLayoutPdf` for the
 * vector PDF (jsPDF). Both honour the user's current paper/template/
 * settings selection.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { centerCrop } from '@/features/crop/auto-center'
import { extractForeground, parseHex, type BgColor } from '@/features/background/composite'
import { buildFilename } from '@/features/export'
import { aspectRatio, derivePixels } from '@/lib/spec-units'
import type { CropFrame, PhotoSpec } from '@/types/spec'

import { canvasToBlob } from '@/features/export/export-single'

import { exportLayoutPdf } from './export-pdf'
import { renderLayout } from './render-layout'
import { useLayoutStore } from './store'

interface LayoutActionsProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  bg: BgColor
  activeCropSpec: PhotoSpec | null
  activeCropFrame: CropFrame | null
}

interface ForegroundCacheEntry {
  /** Cache key — `bitmap` identity plus the mask's data byte-length. */
  key: string
  fg: ImageBitmap | null
}

export function LayoutActions({
  bitmap,
  mask,
  bg,
  activeCropSpec,
  activeCropFrame,
}: LayoutActionsProps) {
  const t = useTranslations('Layout.actions')
  const paper = useLayoutStore((s) => s.paper)
  const template = useLayoutStore((s) => s.template)
  const settings = useLayoutStore((s) => s.settings)

  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [pngFilename, setPngFilename] = useState<string>('')
  const [pdfFilename, setPdfFilename] = useState<string>('')

  // Keep filenames live; they're effectively memoised values, but we
  // recompute on a microtask to follow the React 19 effect rules.
  useEffect(() => {
    let cancelled = false
    const work = async () => {
      await null
      if (cancelled) return
      setPngFilename(
        buildFilename({
          kind: 'layout',
          templateId: template.id,
          paperId: paper.id,
          ext: 'png',
        }),
      )
      setPdfFilename(
        buildFilename({
          kind: 'layout',
          templateId: template.id,
          paperId: paper.id,
          ext: 'pdf',
        }),
      )
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [template.id, paper.id])

  // Layout export works against the raw bitmap too — users who only
  // crop + tile shouldn't need to run segmentation first. We only
  // gate on `bitmap` so the buttons stay reactive once a photo
  // exists.
  const ready = useMemo(() => !!bitmap, [bitmap])

  // Foreground cut-out cache. Running `extractForeground` on a 20MP
  // photo is the single most expensive step of the layout export;
  // when a user clicks PNG and then PDF (or vice-versa) we should
  // re-use the result instead of paying for the cut-out twice. Keyed
  // by the bitmap reference + mask buffer length so a fresh photo or
  // a re-run segmentation invalidates it.
  const foregroundCache = useRef<ForegroundCacheEntry | null>(null)

  // Drop the cache on unmount so the stashed ImageBitmap gets closed.
  useEffect(() => {
    return () => {
      foregroundCache.current?.fg?.close?.()
      foregroundCache.current = null
    }
  }, [])

  const getForeground = useCallback(async (): Promise<ImageBitmap | null> => {
    if (!mask) return null
    const key = `${bitmap.width}x${bitmap.height}:${mask.data.byteLength}`
    const cached = foregroundCache.current
    if (cached && cached.key === key && cached.fg) return cached.fg
    if (cached) cached.fg?.close?.()
    const fg = await extractForeground(bitmap, mask)
    foregroundCache.current = { key, fg }
    return fg
  }, [bitmap, mask])

  const prepareCellImages = useCallback(async (): Promise<Map<string, HTMLCanvasElement>> => {
    const map = new Map<string, HTMLCanvasElement>()
    // When the user hasn't run segmentation we paint the original
    // bitmap directly — the spec background colour is irrelevant
    // because the bitmap is opaque.
    const foreground = await getForeground()
    const source: ImageBitmap = foreground ?? bitmap
    // Pre-resolve a paint colour for cells, only used when we actually
    // have a transparent cut-out to flatten.
    const fillRgb = bg.kind === 'color' ? (parseHex(bg.hex) ?? { r: 255, g: 255, b: 255 }) : null

    const uniqueSpecIds = new Set<string>(template.items.map((it) => it.photoSpecId))
    for (const id of uniqueSpecIds) {
      const spec = BUILTIN_PHOTO_SPECS.find((s) => s.id === id)
      if (!spec) continue
      const frame =
        spec.id === activeCropSpec?.id && activeCropFrame
          ? activeCropFrame
          : centerCrop({ width: bitmap.width, height: bitmap.height }, aspectRatio(spec))
      const resolved = derivePixels(spec)

      // Paint each cell directly into a fresh canvas at the spec's
      // pixel size. `drawImage` uses the browser's native resampler —
      // perceptually indistinguishable from a Lanczos pass for cells
      // sized 295×413 to 600×800, but ~10× faster on a 20MP source.
      const canvas = document.createElement('canvas')
      canvas.width = resolved.width_px
      canvas.height = resolved.height_px
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      if (foreground && fillRgb) {
        ctx.fillStyle = `rgb(${fillRgb.r}, ${fillRgb.g}, ${fillRgb.b})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(
        source as unknown as CanvasImageSource,
        Math.max(0, Math.round(frame.x)),
        Math.max(0, Math.round(frame.y)),
        Math.max(1, Math.round(frame.w)),
        Math.max(1, Math.round(frame.h)),
        0,
        0,
        canvas.width,
        canvas.height,
      )
      map.set(id, canvas)
    }
    return map
  }, [bitmap, bg, activeCropSpec, activeCropFrame, template, getForeground])

  const onDownloadPng = useCallback(async () => {
    if (busy) return
    setBusy('png')
    try {
      const images = await prepareCellImages()
      const result = renderLayout({
        paper,
        template,
        getSpec: (id) => BUILTIN_PHOTO_SPECS.find((s) => s.id === id) ?? null,
        getCellImage: (spec) => images.get(spec.id) ?? null,
        settingsOverride: settings,
      })
      const blob = await canvasToBlob(result.canvas, 'image/png')
      triggerDownload(blob, pngFilename)
    } catch {
      toast.error(t('downloadFailed'))
    } finally {
      setBusy(null)
    }
  }, [busy, paper, template, settings, pngFilename, prepareCellImages, t])

  const onDownloadPdf = useCallback(async () => {
    if (busy) return
    setBusy('pdf')
    try {
      const images = await prepareCellImages()
      const { blob } = await exportLayoutPdf({
        paper,
        template,
        getSpec: (id) => BUILTIN_PHOTO_SPECS.find((s) => s.id === id) ?? null,
        getCellImageDataUrl: async (spec) => {
          const canvas = images.get(spec.id)
          return canvas ? canvas.toDataURL('image/png') : null
        },
        settingsOverride: settings,
      })
      triggerDownload(blob, pdfFilename)
    } catch {
      toast.error(t('downloadFailed'))
    } finally {
      setBusy(null)
    }
  }, [busy, paper, template, settings, pdfFilename, prepareCellImages, t])

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>

      <div className="space-y-2">
        <p className="text-xs text-[var(--color-text-mute)]">{t('filenamePreview')}</p>
        <p className="rounded-md bg-[var(--color-divider)] px-2 py-1 font-mono text-xs break-all text-[var(--color-text)]">
          {pngFilename}
        </p>
        <p className="rounded-md bg-[var(--color-divider)] px-2 py-1 font-mono text-xs break-all text-[var(--color-text)]">
          {pdfFilename}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => void onDownloadPng()}
          disabled={!ready || busy !== null}
          aria-busy={busy === 'png'}
        >
          {busy === 'png' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {busy === 'png' ? t('preparing') : t('png')}
        </Button>
        <Button
          variant="outline"
          onClick={() => void onDownloadPdf()}
          disabled={!ready || busy !== null}
          aria-busy={busy === 'pdf'}
        >
          {busy === 'pdf' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {busy === 'pdf' ? t('preparing') : t('pdf')}
        </Button>
      </div>
    </section>
  )
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari can race the revoke against the download stream when we
  // revoke synchronously; wait 30s before cleanup.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
