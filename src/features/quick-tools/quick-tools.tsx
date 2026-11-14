'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, ImagePlus, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { CropFrameOverlay } from '@/features/crop/crop-frame'
import type { CropFrame, PhotoSpec } from '@/types/spec'
import { UploadDropzone } from '@/components/upload-dropzone'
import { compressToKB } from '@/features/export'
import { triggerDownload } from '@/features/export/dom-download'
import { classifyFileType, trackEvent } from '@/lib/analytics'
import {
  fitSelection,
  positiveInt,
  dimensionToPixels,
  pixelsToDimension,
  pixelsPerUnit,
  type SizeUnit,
} from './quick-tools-utils'

type ImageSource = ImageBitmap | HTMLImageElement
type QuickFormat = 'jpg' | 'png' | 'webp'

const PRESETS = [
  { key: 'original', width: 0, height: 0 },
  { key: 'smallOneInch', width: 260, height: 378 },
  { key: 'oneInch', width: 295, height: 413 },
  { key: 'largeOneInch', width: 390, height: 567 },
  { key: 'smallTwoInch', width: 413, height: 531 },
  { key: 'twoInch', width: 413, height: 579 },
  { key: 'largeTwoInch', width: 413, height: 626 },
  { key: 'passport', width: 390, height: 567 },
  { key: 'square', width: 600, height: 600 },
] as const

const TARGET_OPTIONS = ['none', '20', '50', '100', '200', '500', 'custom'] as const

function isImageSource(value: ImageSource | null): value is ImageSource {
  return value !== null
}

async function decodeImage(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Some browsers expose createImageBitmap but cannot decode every image
      // type. Fall through to the HTMLImageElement path.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function sourceDimensions(source: ImageSource): { width: number; height: number } {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height }
  }
  if ('naturalWidth' in source) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return { width: source.width, height: source.height }
}

function drawSelection(source: ImageSource, canvas: HTMLCanvasElement, crop: CropFrame): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height)
}

function canvasToBlob(canvas: HTMLCanvasElement, format: QuickFormat): Promise<Blob> {
  const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`
  const quality = format === 'jpg' ? 0.92 : format === 'webp' ? 0.85 : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode this image'))),
      mime,
      quality,
    )
  })
}

export function QuickTools() {
  const t = useTranslations('QuickTools')
  const sourceRef = useRef<ImageSource | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<ImageSource | null>(null)
  const [selection, setSelection] = useState<CropFrame | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [width, setWidth] = useState('600')
  const [height, setHeight] = useState('800')
  const [unit, setUnit] = useState<SizeUnit>('px')
  const [dpi, setDpi] = useState('300')
  const [preset, setPreset] = useState('custom')
  const [format, setFormat] = useState<QuickFormat>('jpg')
  const [targetOption, setTargetOption] = useState<(typeof TARGET_OPTIONS)[number]>('none')
  const [customKB, setCustomKB] = useState('100')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    width: number
    height: number
    sizeKB: number
    belowTarget: boolean
  } | null>(null)

  const targetWidth = dimensionToPixels(width, unit, Number(dpi))
  const targetHeight = dimensionToPixels(height, unit, Number(dpi))
  const imageSize = source ? sourceDimensions(source) : null
  const frame =
    imageSize && targetWidth && targetHeight
      ? fitSelection(imageSize.width, imageSize.height, targetWidth, targetHeight, selection)
      : null
  const cropSpec: PhotoSpec | null =
    targetWidth && targetHeight
      ? {
          id: 'quick-tools',
          builtin: false,
          category: 'custom',
          name: { en: 'Custom' },
          width_mm: (targetWidth * 25.4) / 300,
          height_mm: (targetHeight * 25.4) / 300,
          width_px: targetWidth,
          height_px: targetHeight,
          dpi: 300,
        }
      : null

  const targetKB = useMemo(() => {
    if (targetOption === 'none') return null
    if (targetOption === 'custom') return positiveInt(customKB, 100, 10240)
    return Number(targetOption)
  }, [customKB, targetOption])

  const releaseSource = useCallback(() => {
    const current = sourceRef.current
    if (typeof ImageBitmap !== 'undefined' && current instanceof ImageBitmap) current.close()
    sourceRef.current = null
  }, [])

  useEffect(() => releaseSource, [releaseSource])

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !isImageSource(source)) return
    const { width: sourceWidth, height: sourceHeight } = sourceDimensions(source)
    if (!sourceWidth || !sourceHeight) return
    const scale = Math.min(1, 640 / sourceWidth, 480 / sourceHeight)
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(source, 0, 0, canvas.width, canvas.height)
  }, [source])

  const handleFile = useCallback(
    async (nextFile: File) => {
      setError(null)
      setResult(null)
      if (!nextFile.type.startsWith('image/')) {
        setError(t('errors.imageOnly'))
        return
      }
      try {
        const decoded = await decodeImage(nextFile)
        releaseSource()
        sourceRef.current = decoded
        setSource(decoded)
        setSelection(null)
        setFile(nextFile)
        const dimensions = sourceDimensions(decoded)
        setUnit('px')
        setWidth(String(dimensions.width))
        setHeight(String(dimensions.height))
        setPreset('original')
        trackEvent('quick_tool_upload_succeeded', {
          file_type: classifyFileType(nextFile),
        })
      } catch {
        setError(t('errors.decode'))
      }
    },
    [releaseSource, t],
  )

  const handleUnit = (nextUnit: SizeUnit) => {
    if (!targetWidth || !targetHeight) return
    const conversionDpi = positiveInt(dpi, 300, 1200)
    setDpi(String(conversionDpi))
    setWidth(
      pixelsToDimension(
        Number(width) * pixelsPerUnit(unit, conversionDpi),
        nextUnit,
        conversionDpi,
      ),
    )
    setHeight(
      pixelsToDimension(
        Number(height) * pixelsPerUnit(unit, conversionDpi),
        nextUnit,
        conversionDpi,
      ),
    )
    setUnit(nextUnit)
    setResult(null)
  }

  const handlePreset = (value: string) => {
    setResult(null)
    setSelection(frame)
    if (value !== 'custom') setUnit('px')
    setPreset(value)
    if (value === 'original' && source) {
      setSelection(null)
      const dimensions = sourceDimensions(source)
      setWidth(String(dimensions.width))
      setHeight(String(dimensions.height))
      return
    }
    const match = PRESETS.find((item) => item.key === value)
    if (match && match.width > 0) {
      setWidth(String(match.width))
      setHeight(String(match.height))
    }
  }

  const reset = () => {
    releaseSource()
    setSource(null)
    setSelection(null)
    setFile(null)
    setResult(null)
    setError(null)
    setPreset('custom')
    setUnit('px')
    setDpi('300')
    setWidth('600')
    setHeight('800')
    setTargetOption('none')
  }

  const exportImage = async () => {
    if (!source || !targetWidth || !targetHeight || !frame) return
    setBusy(true)
    setError(null)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      drawSelection(source, canvas, frame)

      let blob: Blob
      let belowTarget = false
      let outputWidth = targetWidth
      let outputHeight = targetHeight
      if (targetKB !== null && format !== 'png') {
        const compressed = await compressToKB({
          source: canvas,
          targetKB,
          format,
          initialWidth: targetWidth,
          initialHeight: targetHeight,
          qualityRange: [0.3, 1],
          qualityProbes: 10,
          tolerance: 0.02,
          tryMaxQuality: true,
        })
        belowTarget =
          compressed.quality === 1 && compressed.scale === 1 && compressed.finalKB < targetKB * 0.98
        blob = compressed.blob
        outputWidth = compressed.width
        outputHeight = compressed.height
      } else {
        blob = await canvasToBlob(canvas, format)
      }

      const extension = format === 'jpg' ? 'jpg' : format
      triggerDownload(blob, `pixfit-quick-${outputWidth}x${outputHeight}.${extension}`)
      setResult({ width: outputWidth, height: outputHeight, sizeKB: blob.size / 1024, belowTarget })
      trackEvent('quick_tool_export_succeeded', {
        format,
        target_kb: targetKB ?? 0,
      })
    } catch {
      setError(t('errors.export'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
      <div className="min-w-0 space-y-6">
        {!source ? (
          <UploadDropzone
            onSelect={(nextFile) => void handleFile(nextFile)}
            analyticsSurface="home"
            className="min-h-[22rem]"
          />
        ) : (
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                  {file?.name}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-mute)]">
                  {sourceDimensions(source).width}×{sourceDimensions(source).height} px
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-mute)] transition-colors hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('replace')}
              </button>
            </div>
            <div className="flex min-h-[22rem] items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-bg)] p-4">
              <div
                className="relative max-w-full overflow-hidden rounded shadow-[var(--shadow-sm)]"
                style={{
                  width: imageSize
                    ? Math.min(640, (480 * imageSize.width) / imageSize.height)
                    : 640,
                }}
                aria-label={t('cropHint')}
              >
                <canvas ref={previewRef} className="block h-auto w-full" />
                {frame && cropSpec && imageSize && (
                  <CropFrameOverlay
                    imageW={imageSize.width}
                    imageH={imageSize.height}
                    spec={cropSpec}
                    frame={frame}
                    onChange={(next) => {
                      setSelection(next)
                      setResult(null)
                    }}
                  />
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-[var(--color-text-mute)]">
              {t('cropHint')}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-5 flex items-center gap-2">
          <SlidersHorizontal className="size-5 text-[var(--color-primary)]" aria-hidden="true" />
          <h2 className="font-semibold text-[var(--color-text)]">{t('settings.title')}</h2>
        </div>

        <div className="space-y-5">
          <fieldset disabled={!source} className="space-y-3">
            <legend className="text-sm font-medium text-[var(--color-text)]">
              {t('settings.size')}
            </legend>
            <label className="block text-xs text-[var(--color-text-mute)]" htmlFor="quick-preset">
              {t('settings.preset')}
            </label>
            <select
              id="quick-preset"
              value={preset}
              onChange={(event) => handlePreset(event.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)]"
            >
              <option value="custom">{t('settings.custom')}</option>
              {PRESETS.map((item) => (
                <option key={item.key} value={item.key}>
                  {t(`settings.presets.${item.key}`)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--color-text-mute)]">
                {t('settings.unit')}
                <select
                  value={unit}
                  disabled={!targetWidth || !targetHeight}
                  onChange={(event) => handleUnit(event.target.value as SizeUnit)}
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)]"
                >
                  {(['px', 'mm', 'cm', 'in'] as const).map((value) => (
                    <option key={value} value={value}>
                      {t(`settings.units.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
              {unit !== 'px' && (
                <label className="text-xs text-[var(--color-text-mute)]">
                  {t('settings.dpi')}
                  <input
                    type="number"
                    min={1}
                    max={1200}
                    step={1}
                    inputMode="numeric"
                    value={dpi}
                    onChange={(event) => {
                      setDpi(event.target.value)
                      setPreset('custom')
                      setResult(null)
                    }}
                    className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)]"
                  />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--color-text-mute)]">
                {t('settings.width', { unit })}
                <input
                  inputMode={unit === 'px' ? 'numeric' : 'decimal'}
                  type="number"
                  min={unit === 'px' ? 1 : 0.000001}
                  step={unit === 'px' ? 1 : 'any'}
                  value={width}
                  onChange={(event) => {
                    setPreset('custom')
                    setResult(null)
                    setWidth(event.target.value)
                  }}
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)]"
                />
              </label>
              <label className="text-xs text-[var(--color-text-mute)]">
                {t('settings.height', { unit })}
                <input
                  inputMode={unit === 'px' ? 'numeric' : 'decimal'}
                  type="number"
                  min={unit === 'px' ? 1 : 0.000001}
                  step={unit === 'px' ? 1 : 'any'}
                  value={height}
                  onChange={(event) => {
                    setPreset('custom')
                    setResult(null)
                    setHeight(event.target.value)
                  }}
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)]"
                />
              </label>
            </div>
            <p className="text-xs text-[var(--color-text-mute)]">{t('settings.sizeHint')}</p>
            {targetWidth && targetHeight ? (
              <p className="text-xs text-[var(--color-text-mute)]" aria-live="polite">
                {t('settings.outputPixels', { width: targetWidth, height: targetHeight })}
              </p>
            ) : (
              <p role="alert" className="text-xs text-red-700">
                {t('settings.invalidSize')}
              </p>
            )}
            {unit !== 'px' && (
              <p className="text-xs text-[var(--color-text-mute)]">{t('settings.dpiHint')}</p>
            )}
          </fieldset>

          <label
            className="block text-sm font-medium text-[var(--color-text)]"
            htmlFor="quick-format"
          >
            {t('settings.format')}
            <select
              id="quick-format"
              disabled={!source}
              value={format}
              onChange={(event) => {
                setFormat(event.target.value as QuickFormat)
                setResult(null)
              }}
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm font-normal text-[var(--color-text)] disabled:opacity-50"
            >
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </label>

          <label
            className="block text-sm font-medium text-[var(--color-text)]"
            htmlFor="quick-target-size"
          >
            {t('settings.fileSize')}
            <select
              id="quick-target-size"
              disabled={!source}
              value={targetOption}
              onChange={(event) => {
                setTargetOption(event.target.value as (typeof TARGET_OPTIONS)[number])
                setResult(null)
              }}
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm font-normal text-[var(--color-text)] disabled:opacity-50"
            >
              {TARGET_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'none'
                    ? t('settings.noLimit')
                    : option === 'custom'
                      ? t('settings.custom')
                      : `${option} KB`}
                </option>
              ))}
            </select>
          </label>

          {targetOption === 'custom' && (
            <label
              className="block text-xs text-[var(--color-text-mute)]"
              htmlFor="quick-custom-kb"
            >
              {t('settings.customKB')}
              <input
                id="quick-custom-kb"
                inputMode="numeric"
                type="number"
                min={1}
                max={10240}
                value={customKB}
                onChange={(event) => {
                  setCustomKB(event.target.value)
                  setResult(null)
                }}
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)]"
              />
            </label>
          )}

          {format === 'png' && targetKB !== null && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] px-3 py-2 text-xs text-[var(--color-text-mute)]">
              {t('settings.pngHint')}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius-md)] bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {result && (
            <p className="rounded-[var(--radius-md)] bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {t('result', {
                width: result.width,
                height: result.height,
                kb: result.sizeKB.toFixed(1),
              })}
            </p>
          )}

          {result?.belowTarget && (
            <p className="text-xs text-[var(--color-text-mute)]">{t('belowTarget')}</p>
          )}

          <button
            type="button"
            disabled={!source || busy || !targetWidth || !targetHeight}
            onClick={() => void exportImage()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-primary-dk)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t('processing') : <Download className="size-4" aria-hidden="true" />}
            {busy ? t('processing') : t('download')}
          </button>

          <div className="flex items-start gap-2 text-xs text-[var(--color-text-mute)]">
            <ImagePlus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{t('privacy')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
