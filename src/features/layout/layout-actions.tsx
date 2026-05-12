'use client'

/**
 * Download buttons for the layout tab — PNG (raster) and PDF (vector).
 *
 * Reuses `renderLayout` for the PNG path and `exportLayoutPdf` for the
 * vector PDF (jsPDF). Both honour the user's current paper/template/
 * settings selection.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { centerCrop } from '@/features/crop/auto-center'
import { extractForeground, type BgColor } from '@/features/background/composite'
import { buildFilename, exportSingle } from '@/features/export'
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

  const prepareCellImages = useCallback(async (): Promise<Map<string, HTMLCanvasElement>> => {
    const map = new Map<string, HTMLCanvasElement>()
    // Source pixels for each cell: cut-out + chosen bg when the user
    // has run segmentation; otherwise the original bitmap (the spec
    // background colour is irrelevant — the bitmap is opaque).
    const foreground: ImageBitmap | null = mask ? await extractForeground(bitmap, mask) : null
    const source: ImageBitmap = foreground ?? bitmap
    try {
      const uniqueSpecIds = new Set<string>(template.items.map((it) => it.photoSpecId))
      for (const id of uniqueSpecIds) {
        const spec = BUILTIN_PHOTO_SPECS.find((s) => s.id === id)
        if (!spec) continue
        const frame =
          spec.id === activeCropSpec?.id && activeCropFrame
            ? activeCropFrame
            : centerCrop({ width: bitmap.width, height: bitmap.height }, aspectRatio(spec))
        const resolved = derivePixels(spec)
        const result = await exportSingle({
          foreground: source,
          bg,
          format: 'png-flat',
          targetPixels: { width: resolved.width_px, height: resolved.height_px },
          frame,
        })
        const decoded = await blobToBitmap(result.blob)
        const canvas = document.createElement('canvas')
        canvas.width = decoded.width
        canvas.height = decoded.height
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(decoded, 0, 0)
        decoded.close?.()
        map.set(id, canvas)
      }
    } finally {
      foreground?.close?.()
    }
    return map
  }, [bitmap, mask, bg, activeCropSpec, activeCropFrame, template])

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
        <Button onClick={() => void onDownloadPng()} disabled={!ready || busy !== null}>
          <Download className="size-4" aria-hidden />
          {busy === 'png' ? t('preparing') : t('png')}
        </Button>
        <Button
          variant="outline"
          onClick={() => void onDownloadPdf()}
          disabled={!ready || busy !== null}
        >
          <Download className="size-4" aria-hidden />
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
  URL.revokeObjectURL(url)
}

async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob)
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img as unknown as ImageBitmap
  } finally {
    URL.revokeObjectURL(url)
  }
}
