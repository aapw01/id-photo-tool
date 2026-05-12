'use client'

/**
 * Single-photo export panel.
 *
 * Composites the current background into an offscreen canvas, then
 * emits a PNG (alpha-preserving) or a JPG (white-flattened) blob and
 * triggers a download. The same blob can be copied to the clipboard
 * for paste-into-chat workflows.
 *
 * Filename follows PRD §5.8.4. M3 doesn't have a `photoSpec` yet, so
 * the prefix is `pixfit` — once M4 ships, the spec id replaces it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { extractForeground, compositeOnto, parseHex, type BgColor } from './composite'
import { derivePixels } from '@/lib/spec-units'
import type { CropFrame, PhotoSpec } from '@/types/spec'

interface ExportPanelProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  bg: BgColor
  disabled?: boolean
  /** Optional crop frame (image-pixel space). When set together with
   * `spec`, the export is cropped to that frame and resampled to the
   * spec's pixel dimensions. */
  spec?: PhotoSpec | null
  frame?: CropFrame | null
}

type Format = 'png' | 'jpg'

export function ExportPanel({ bitmap, mask, bg, disabled, spec, frame }: ExportPanelProps) {
  const t = useTranslations('Export')

  // Cached foreground (subject on transparent). Re-extracted when
  // bitmap or mask changes — same idea as the preview canvas.
  const [foreground, setForeground] = useState<ImageBitmap | null>(null)
  const [pngSize, setPngSize] = useState<number | null>(null)
  const [jpgSize, setJpgSize] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const work = async () => {
      await null
      if (cancelled) return
      if (!mask) {
        setForeground((prev) => {
          prev?.close?.()
          return null
        })
        return
      }
      const fg = await extractForeground(bitmap, mask)
      if (cancelled) {
        fg.close?.()
        return
      }
      setForeground((prev) => {
        prev?.close?.()
        return fg
      })
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [bitmap, mask])

  // When a spec + frame are present we crop & resample to the spec's
  // pixel dimensions; otherwise we emit the full bitmap.
  const exportSize = useMemo(() => {
    if (spec && frame) {
      const r = derivePixels(spec)
      return { width: r.width_px, height: r.height_px }
    }
    return { width: bitmap.width, height: bitmap.height }
  }, [spec, frame, bitmap])

  // Estimate file sizes for both formats whenever the cached
  // foreground or chosen bg changes. Computed in parallel; both call
  // canvas.toBlob, which is async + non-blocking.
  useEffect(() => {
    let cancelled = false
    const work = async () => {
      await null
      if (cancelled) return
      if (!foreground) {
        setPngSize(null)
        setJpgSize(null)
        return
      }
      const [png, jpg] = await Promise.all([
        buildBlob(foreground, bitmap.width, bitmap.height, bg, 'png', frame ?? null, exportSize),
        buildBlob(foreground, bitmap.width, bitmap.height, bg, 'jpg', frame ?? null, exportSize),
      ])
      if (cancelled) return
      setPngSize(png?.size ?? null)
      setJpgSize(jpg?.size ?? null)
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [foreground, bitmap, bg, frame, exportSize])

  const filenameBase = useMemo(() => {
    const prefix = spec ? spec.id : 'pixfit'
    return `${prefix}_${exportSize.width}x${exportSize.height}_${formatDate(new Date())}`
  }, [spec, exportSize])

  const onDownload = useCallback(
    async (format: Format) => {
      if (!foreground) return
      const blob = await buildBlob(
        foreground,
        bitmap.width,
        bitmap.height,
        bg,
        format,
        frame ?? null,
        exportSize,
      )
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${filenameBase}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    },
    [foreground, bitmap, bg, frame, exportSize, filenameBase],
  )

  const onCopy = useCallback(async () => {
    if (!foreground) return
    try {
      const blob = await buildBlob(
        foreground,
        bitmap.width,
        bitmap.height,
        bg,
        'png',
        frame ?? null,
        exportSize,
      )
      if (!blob) throw new Error('no blob')
      const item = new ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }, [foreground, bitmap, bg, frame, exportSize, t])

  const blocked = disabled || !mask || !foreground

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => void onDownload('png')}
          disabled={blocked}
          className="justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <Download className="size-4" aria-hidden />
            {t('actions.png')}
          </span>
          {pngSize ? (
            <span className="font-mono text-xs opacity-80">
              {t('size', { kb: Math.round(pngSize / 1024) })}
            </span>
          ) : null}
        </Button>
        <p className="text-xs text-[var(--color-text-mute)]">{t('hint.png')}</p>

        <Button
          variant="outline"
          onClick={() => void onDownload('jpg')}
          disabled={blocked}
          className="mt-2 justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <Download className="size-4" aria-hidden />
            {t('actions.jpg')}
          </span>
          {jpgSize ? (
            <span className="font-mono text-xs opacity-80">
              {t('size', { kb: Math.round(jpgSize / 1024) })}
            </span>
          ) : null}
        </Button>
        <p className="text-xs text-[var(--color-text-mute)]">{t('hint.jpg')}</p>

        <Button
          variant="ghost"
          onClick={() => void onCopy()}
          disabled={blocked}
          className="mt-2 justify-center"
        >
          <Copy className="size-4" aria-hidden />
          {t('actions.copy')}
        </Button>
        <p className="text-xs text-[var(--color-text-mute)]">{t('hint.copy')}</p>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function buildBlob(
  foreground: ImageBitmap,
  srcW: number,
  srcH: number,
  bg: BgColor,
  format: Format,
  frame: CropFrame | null,
  outSize: { width: number; height: number },
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = outSize.width
  canvas.height = outSize.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (frame) {
    // Cropped + resampled path: paint background first, then draw the
    // foreground sub-region scaled to the spec's pixel size. JPG path
    // pre-fills with white when no solid bg was chosen.
    if (format === 'jpg') {
      const fillColor = bg.kind === 'color' ? bg.hex : '#FFFFFF'
      const rgb = parseHex(fillColor)
      ctx.fillStyle = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '#FFFFFF'
      ctx.fillRect(0, 0, outSize.width, outSize.height)
    } else if (bg.kind === 'color') {
      const rgb = parseHex(bg.hex)
      if (rgb) {
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
        ctx.fillRect(0, 0, outSize.width, outSize.height)
      }
    }
    // High-quality downscale for typical export ratios.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      foreground,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      outSize.width,
      outSize.height,
    )
  } else if (format === 'jpg') {
    const fillColor = bg.kind === 'color' ? bg.hex : '#FFFFFF'
    const rgb = parseHex(fillColor)
    ctx.fillStyle = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '#FFFFFF'
    ctx.fillRect(0, 0, srcW, srcH)
    ctx.drawImage(foreground, 0, 0, srcW, srcH)
  } else {
    compositeOnto(ctx, foreground, srcW, srcH, bg)
  }

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92),
  )
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}
