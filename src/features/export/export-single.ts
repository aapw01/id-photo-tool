/**
 * Single-photo export pipeline.
 *
 * Inputs: a cached `foreground` (subject on transparent), an optional
 * `frame` describing the spec-aligned crop, a target pixel size, the
 * chosen background, and a format.
 *
 * Outputs: a Blob in the chosen format. Transparency is preserved for
 * `png-alpha` and `webp`; `png-flat` and `jpg` flatten onto either the
 * chosen background colour or white (JPG has no alpha channel).
 *
 * The cropping + resampling step is shared by all formats. We funnel
 * everything through `resample()` first so a final 600×600 visa export
 * gets a Lanczos pass instead of a soft drawImage.
 */

import { resample } from './resample'
import { parseHex, type BgColor } from '@/features/background/composite'

export type ExportFormat = 'png-alpha' | 'png-flat' | 'jpg' | 'webp'

export interface ExportOptions {
  /** Subject cut out on transparent (image-pixel space). */
  foreground: ImageBitmap | HTMLCanvasElement | OffscreenCanvas
  /** Background to flatten onto (ignored for png-alpha + webp+transparent). */
  bg: BgColor
  /** Output format & encoder. */
  format: ExportFormat
  /** Final pixel dimensions of the export. */
  targetPixels: { width: number; height: number }
  /** Optional crop window in *source* pixels. When provided we draw
   * `frame` from `foreground` instead of the whole bitmap. */
  frame?: { x: number; y: number; w: number; h: number } | null
  /** Quality 0..1, only honoured by JPG / WebP. Defaults to 0.92 / 0.85. */
  quality?: number
}

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  mimeType: string
}

/**
 * Produce a Blob in the chosen format. The work is async because the
 * resampler and `canvas.toBlob` are both async, but the caller stays
 * snappy: we never hold more than two canvases in memory at a time.
 */
export async function exportSingle(opts: ExportOptions): Promise<ExportResult> {
  const { targetPixels, foreground, frame, format } = opts
  const width = Math.max(1, Math.round(targetPixels.width))
  const height = Math.max(1, Math.round(targetPixels.height))

  // Step 1 — crop the foreground at *native* resolution (no scaling)
  // and hand that to Pica so the Lanczos kernel has all the original
  // signal to work with. Skipping the crop when no frame is provided
  // keeps a single-resample fast path.
  const cropSource = frame ? cropAtNativeResolution(foreground, frame) : foreground
  const fgCanvas = await resample({
    source: cropSource,
    targetWidth: width,
    targetHeight: height,
  })

  // Step 2 — flatten onto a bg colour when the format demands it.
  const flat = flattenIfNeeded(fgCanvas, opts.bg, format)

  // Step 3 — encode. `convertToBlob` is also exposed by OffscreenCanvas
  // but we already have an HTMLCanvasElement, so `toBlob` is the most
  // compatible path.
  const mimeType = mimeFor(format)
  const quality = pickQuality(format, opts.quality)
  const blob = await canvasToBlob(flat, mimeType, quality)
  return { blob, width, height, mimeType }
}

/** Map an internal format to a Web mime type. */
export function mimeFor(format: ExportFormat): string {
  switch (format) {
    case 'png-alpha':
    case 'png-flat':
      return 'image/png'
    case 'jpg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
  }
}

/** Whether the format keeps an alpha channel in its bytes. */
export function preservesAlpha(format: ExportFormat): boolean {
  return format === 'png-alpha' || format === 'webp'
}

/** Default encoder quality per PRD §5.8.1. */
function pickQuality(format: ExportFormat, override?: number): number | undefined {
  if (format === 'jpg') return override ?? 0.92
  if (format === 'webp') return override ?? 0.85
  return undefined
}

/**
 * Crop the foreground to the supplied frame at its native resolution.
 * No scaling happens here — the downstream Lanczos resampler does that
 * with the full pixel signal. Output is a DOM canvas because Pica's
 * input contract expects HTMLCanvasElement / ImageBitmap.
 */
function cropAtNativeResolution(
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  frame: NonNullable<ExportOptions['frame']>,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(frame.w))
  const h = Math.max(1, Math.round(frame.h))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.drawImage(source as CanvasImageSource, frame.x, frame.y, frame.w, frame.h, 0, 0, w, h)
  return c
}

/**
 * For formats that can't carry alpha (JPG), or for png-flat which
 * intentionally bakes the background, paint a solid colour first and
 * stamp the foreground on top. For png-alpha and webp+transparent we
 * return the foreground untouched.
 */
function flattenIfNeeded(
  fg: HTMLCanvasElement,
  bg: BgColor,
  format: ExportFormat,
): HTMLCanvasElement {
  if (preservesAlpha(format) && bg.kind === 'transparent') return fg
  if (format === 'png-alpha') return fg

  const out = document.createElement('canvas')
  out.width = fg.width
  out.height = fg.height
  const ctx = out.getContext('2d')
  if (!ctx) return fg

  // JPG forces white when transparent (no alpha support).
  // PNG-flat / WebP-flat use the picked colour, with white as a sane fallback.
  const fillHex = bg.kind === 'color' ? bg.hex : '#FFFFFF'
  const rgb = parseHex(fillHex) ?? { r: 255, g: 255, b: 255 }
  ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(fg, 0, 0)
  return out
}

/**
 * Promise wrapper around `canvas.toBlob`. happy-dom returns null for
 * unsupported mime types — surface that as a clear error so retries
 * higher up the stack know to fall back to PNG.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error(`canvas.toBlob returned null for ${mimeType}`))
        else resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}
