'use client'

/**
 * Watermark drawing — mandatory per the PRD (§9.1, "anti-misuse
 * watermark cannot be fully disabled").
 *
 * Enforcement levers:
 *
 *   - `MIN_OPACITY = 0.3` — clamped at the renderer regardless of
 *     the UI control, so a tampered store value can't disable it.
 *   - `MAX_OPACITY = 0.7` — keeps the document still readable.
 *   - Diagonal tiled layout — covers the entire output, not just a
 *     stamp; a single crop or rotation can't remove it.
 *   - Both fill and stroke — survives moderate JPEG re-compression
 *     better than fill-only.
 *
 * The watermark is rendered on a 2D canvas context the caller
 * supplies, so the same kernel works for per-side previews and the
 * A4 PDF layout (in S5's pack-a4.ts).
 */

import type { OutputMode } from './render-modes'

export const MIN_WATERMARK_OPACITY = 0.3
export const MAX_WATERMARK_OPACITY = 0.7
export const DEFAULT_WATERMARK_OPACITY = 0.4

export type WatermarkDensity = 'sparse' | 'normal' | 'dense'

export interface WatermarkConfig {
  /** Localized fallback applied when the user clears the input. */
  text: string
  opacity: number
  density: WatermarkDensity
}

const DEFAULT_TEXTS: Record<string, string> = {
  'zh-Hans': '仅供本次申请使用',
  'zh-Hant': '僅供本次申請使用',
  en: 'For this application only',
}

/**
 * Resolve a localized default watermark text. The Scanner UI shows
 * this as the input placeholder; if the user empties the field we
 * still draw the localized default so the watermark stays mandatory.
 */
export function getDefaultWatermarkText(locale: string): string {
  return DEFAULT_TEXTS[locale] ?? DEFAULT_TEXTS['en']!
}

export function clampWatermarkOpacity(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_WATERMARK_OPACITY
  if (value < MIN_WATERMARK_OPACITY) return MIN_WATERMARK_OPACITY
  if (value > MAX_WATERMARK_OPACITY) return MAX_WATERMARK_OPACITY
  return value
}

interface DensitySpec {
  rowSpacingMul: number
  textGapMul: number
}

const DENSITY_TABLE: Record<WatermarkDensity, DensitySpec> = {
  sparse: { rowSpacingMul: 6, textGapMul: 3 },
  normal: { rowSpacingMul: 4, textGapMul: 1.8 },
  dense: { rowSpacingMul: 2.5, textGapMul: 1.2 },
}

/**
 * Draw a diagonal tiled watermark over the entire 2D canvas.
 *
 * The caller is expected to have already drawn the document image
 * (we composite on top via `globalAlpha` rather than re-encoding).
 *
 * `mode` is used to choose a readable color: black-on-white for
 * scan/enhance, light gray on the copy mode's pure-white background
 * (so the watermark stays subtle but still survives photocopying).
 */
/**
 * Hardcoded fallback so an empty / tampered config can never disable
 * the watermark. The UI substitutes a locale-aware default before
 * the user sees the input, but a manually-cleared field still ends
 * up here with this string — keeps the anti-misuse guarantee.
 */
const FALLBACK_WATERMARK_TEXT = 'PIXFIT · For this application only'

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  mode: OutputMode,
): void {
  const text = (config.text || '').trim() || FALLBACK_WATERMARK_TEXT

  const opacity = clampWatermarkOpacity(config.opacity)
  const density = DENSITY_TABLE[config.density] ?? DENSITY_TABLE.normal
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.045))

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = mode === 'copy' ? '#666' : '#000'
  ctx.strokeStyle = mode === 'copy' ? '#888' : '#222'
  ctx.lineWidth = Math.max(1, fontSize * 0.06)
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Diagonal tiling — rotate around the center, then walk a regular
  // grid in the rotated frame. Bounds extend past the canvas so the
  // tiles fully cover the corners after rotation.
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 6) // -30°

  const rowSpacing = fontSize * density.rowSpacingMul
  // Pre-measure once for the column step.
  const textMetrics = ctx.measureText(text)
  const colStep = textMetrics.width + fontSize * density.textGapMul

  const span = Math.max(width, height) * 1.4
  for (let y = -span; y <= span; y += rowSpacing) {
    // Stagger every other row by half-step so the tile pattern
    // doesn't look like a vertical grid.
    const stagger = (Math.floor(y / rowSpacing) & 1) === 0 ? 0 : colStep / 2
    for (let x = -span + stagger; x <= span; x += colStep) {
      ctx.fillText(text, x, y)
      ctx.strokeText(text, x, y)
    }
  }
  ctx.restore()
}
