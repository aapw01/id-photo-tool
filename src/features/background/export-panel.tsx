'use client'

/**
 * Single-photo export panel — M5.
 *
 * Three groups of controls:
 *
 *   1. Format select — png-alpha / png-flat / jpg / webp. Names are
 *      i18n'd; the alpha variants are explained in `hint.*`.
 *   2. Quality slider — visible only for JPG / WebP, ranges 30–100 %
 *      with a 1 % step. The internal value is float quality 0..1.
 *   3. Compress-to-KB — toggle + numeric input. When on, the export
 *      pipeline runs `compressToKB` and feeds the resulting blob to
 *      the download button. When off, single-blob export runs.
 *
 * The panel reads `spec` + `frame` from the parent (Studio passes
 * them through) and shows a filename preview using `buildFilename`.
 * Size estimates per format render in the small badge next to each
 * format option, refreshed whenever the foreground or settings
 * change.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Download, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildFilename, compressToKB, exportSingle, type ExportFormat } from '@/features/export'
import { derivePixels } from '@/lib/spec-units'
import { useIsWeChat } from '@/lib/ua'
import { cn } from '@/lib/utils'
import type { CropFrame, PhotoSpec } from '@/types/spec'

import { extractForeground, type BgColor } from './composite'

interface ExportPanelProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  bg: BgColor
  disabled?: boolean
  spec?: PhotoSpec | null
  frame?: CropFrame | null
}

const FORMATS: ExportFormat[] = ['png-alpha', 'png-flat', 'jpg', 'webp']

export function ExportPanel({ bitmap, mask, bg, disabled, spec, frame }: ExportPanelProps) {
  const t = useTranslations('Export')

  const [foreground, setForeground] = useState<ImageBitmap | null>(null)
  const [format, setFormat] = useState<ExportFormat>('png-alpha')
  const [quality, setQuality] = useState<number>(0.92)
  const [compress, setCompress] = useState<boolean>(false)
  // Suggest the spec's maxKB when present, otherwise a sensible default.
  const [targetKB, setTargetKB] = useState<number>(() => spec?.fileRules?.maxKB ?? 100)
  const [estimates, setEstimates] = useState<Record<ExportFormat, number | null>>({
    'png-alpha': null,
    'png-flat': null,
    jpg: null,
    webp: null,
  })

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

  // Refresh the default target KB when the spec changes. We only nudge
  // the value if the spec carries an explicit rule — otherwise users
  // who typed a custom number keep it. Use `await null` to defer the
  // setState past the synchronous effect body (React 19 rule).
  useEffect(() => {
    const maxKB = spec?.fileRules?.maxKB
    if (!maxKB) return
    let cancelled = false
    const apply = async () => {
      await null
      if (cancelled) return
      setTargetKB(maxKB)
    }
    void apply()
    return () => {
      cancelled = true
    }
  }, [spec?.fileRules?.maxKB])

  // The target pixel size is the spec's resolved pixel box if both
  // spec and frame are present; otherwise the source bitmap size.
  const targetPixels = useMemo(() => {
    if (spec && frame) {
      const r = derivePixels(spec)
      return { width: r.width_px, height: r.height_px }
    }
    return { width: bitmap.width, height: bitmap.height }
  }, [spec, frame, bitmap])

  // Estimate file sizes for every format using the cached foreground.
  useEffect(() => {
    let cancelled = false
    const work = async () => {
      await null
      if (cancelled) return
      if (!foreground) {
        setEstimates({ 'png-alpha': null, 'png-flat': null, jpg: null, webp: null })
        return
      }
      const next: Record<ExportFormat, number | null> = {
        'png-alpha': null,
        'png-flat': null,
        jpg: null,
        webp: null,
      }
      await Promise.all(
        FORMATS.map(async (f) => {
          try {
            const result = await exportSingle({
              foreground,
              bg,
              format: f,
              targetPixels,
              frame: frame ?? null,
              quality: f === 'jpg' || f === 'webp' ? quality : undefined,
            })
            next[f] = result.blob.size
          } catch {
            next[f] = null
          }
        }),
      )
      if (cancelled) return
      setEstimates(next)
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [foreground, bg, targetPixels, frame, quality])

  // Filename preview: layout/single/compressed swap based on toggle.
  const filename = useMemo(() => {
    const ext = format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'
    if (compress && (format === 'jpg' || format === 'webp')) {
      return buildFilename({
        kind: 'compressed',
        spec: spec ?? null,
        ext,
        targetKB: Math.round(targetKB),
        width: targetPixels.width,
        height: targetPixels.height,
      })
    }
    return buildFilename({
      kind: 'single',
      spec: spec ?? null,
      ext,
      width: targetPixels.width,
      height: targetPixels.height,
    })
  }, [format, compress, targetKB, targetPixels, spec])

  const isAlpha = format === 'png-alpha' || format === 'webp'
  const supportsCompress = format === 'jpg' || format === 'webp'

  const onDownload = useCallback(async () => {
    if (!foreground) return
    try {
      let blob: Blob
      if (compress && supportsCompress) {
        const result = await compressToKB({
          source: foreground,
          targetKB,
          format: format === 'jpg' ? 'jpg' : 'webp',
          initialWidth: targetPixels.width,
          initialHeight: targetPixels.height,
        })
        blob = result.blob
        if (!result.hit) {
          toast.warning(t('compressMiss', { kb: Math.round(result.finalKB) }))
        }
      } else {
        const result = await exportSingle({
          foreground,
          bg,
          format,
          targetPixels,
          frame: frame ?? null,
          quality: supportsCompress ? quality : undefined,
        })
        blob = result.blob
      }

      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error(t('downloadFailed'))
    }
  }, [
    foreground,
    compress,
    supportsCompress,
    targetKB,
    format,
    targetPixels,
    bg,
    frame,
    quality,
    filename,
    t,
  ])

  const onCopy = useCallback(async () => {
    if (!foreground) return
    try {
      const result = await exportSingle({
        foreground,
        bg,
        format: 'png-alpha',
        targetPixels,
        frame: frame ?? null,
      })
      const item = new ClipboardItem({ 'image/png': result.blob })
      await navigator.clipboard.write([item])
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }, [foreground, bg, targetPixels, frame, t])

  const blocked = disabled || !mask || !foreground

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-[var(--color-text)]">{t('format.label')}</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('format.label')}>
          {FORMATS.map((f) => {
            const active = format === f
            const kb = estimates[f]
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFormat(f)}
                className={cn(
                  'flex h-auto flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
                  active
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : 'border-[var(--color-border)] bg-transparent hover:bg-[var(--color-divider)]',
                )}
              >
                <span className="text-sm text-[var(--color-text)]">
                  {t(`format.${f}` as 'format.png-alpha')}
                </span>
                <span className="font-mono text-xs text-[var(--color-text-mute)]">
                  {kb !== null ? t('size', { kb: Math.round(kb / 1024) }) : '—'}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-[var(--color-text-mute)]">
          {t(isAlpha ? 'hint.alpha' : 'hint.flat')}
        </p>
      </div>

      {supportsCompress ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="quality-slider"
              className="text-xs font-medium text-[var(--color-text)]"
            >
              {t('quality')}
            </Label>
            <span className="font-mono text-xs text-[var(--color-text-mute)]">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <input
            id="quality-slider"
            type="range"
            min={30}
            max={100}
            step={1}
            value={Math.round(quality * 100)}
            onChange={(e) => setQuality(Number(e.target.value) / 100)}
            disabled={compress}
            className="w-full accent-[var(--color-primary)] disabled:opacity-50"
          />
          {compress ? (
            <p className="text-xs text-[var(--color-text-mute)]">{t('qualityLockedByCompress')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-divider)] p-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="compress-toggle" className="text-xs font-medium text-[var(--color-text)]">
            {t('compressToKB')}
          </Label>
          <input
            id="compress-toggle"
            type="checkbox"
            checked={compress}
            disabled={!supportsCompress}
            onChange={(e) => setCompress(e.target.checked)}
            className="size-4 accent-[var(--color-primary)] disabled:opacity-50"
          />
        </div>
        {supportsCompress ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={5000}
                step={1}
                value={targetKB}
                onChange={(e) => setTargetKB(Math.max(1, Number(e.target.value) || 1))}
                disabled={!compress}
                className="h-8 w-24 font-mono text-xs"
              />
              <span className="text-xs text-[var(--color-text-mute)]">KB</span>
            </div>
            <p className="text-xs text-[var(--color-text-mute)]">{t('kbHint')}</p>
          </>
        ) : (
          <p className="text-xs text-[var(--color-text-mute)]">{t('compressUnsupported')}</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[var(--color-text-mute)]">{t('filenamePreview')}</p>
        <p className="rounded-md bg-[var(--color-divider)] px-2 py-1 font-mono text-xs break-all text-[var(--color-text)]">
          {filename}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => void onDownload()}
          disabled={blocked}
          style={{ touchAction: 'manipulation' }}
        >
          <Download className="size-4" aria-hidden />
          {t('actions.download')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => void onCopy()}
          disabled={blocked}
          style={{ touchAction: 'manipulation' }}
        >
          <Copy className="size-4" aria-hidden />
          {t('actions.copy')}
        </Button>
      </div>

      <WeChatSaveHint />
    </section>
  )
}

function WeChatSaveHint() {
  const tExport = useTranslations('Export')
  const isWx = useIsWeChat()
  if (!isWx) return null
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-3 text-xs leading-relaxed text-[var(--color-text)]"
    >
      <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-dk)]" aria-hidden />
      <span>{tExport('wechatHint')}</span>
    </div>
  )
}
