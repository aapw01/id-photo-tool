'use client'

/**
 * Watermark drawing — optional anti-misuse overlay the user can opt
 * into via the Scanner config panel. Off by default.
 *
 * Knobs when the user enables it:
 *
 *   - `MIN_OPACITY = 0.3` / `MAX_OPACITY = 0.7` — clamped so an
 *     enabled watermark is always visible enough to deter casual
 *     misuse but never opaque enough to block document content.
 *   - Diagonal tiled layout — covers the entire output once on,
 *     making a single crop or rotation insufficient to strip it.
 *   - Both fill and stroke — survives moderate JPEG re-compression
 *     better than fill-only.
 *
 * The watermark is rendered on a 2D canvas context the caller
 * supplies, so the same kernel works for per-side previews and the
 * A4 PDF layout (in S5's pack-a4.ts).
 *
 * When `config.enabled === false` `drawWatermark` returns immediately
 * — callers are still encouraged to gate the call so they don't pay
 * any setup cost, but the kernel-level guard makes the contract
 * bulletproof.
 */

import type { OutputMode } from './render-modes'

export const MIN_WATERMARK_OPACITY = 0.3
export const MAX_WATERMARK_OPACITY = 0.7
export const DEFAULT_WATERMARK_OPACITY = 0.4

export type WatermarkDensity = 'sparse' | 'normal' | 'dense'

export interface WatermarkConfig {
  /**
   * Whether the watermark should be drawn at all. Default off — the
   * Scanner store initialises this to `false` so previews and exports
   * stay clean unless the user explicitly opts in.
   */
  enabled: boolean
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
 * this as the input placeholder; when the user enables the watermark
 * but leaves the field empty, this string seeds the actual draw.
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
 *
 * A `config.enabled === false` short-circuits before any state is
 * touched — defence in depth so a stale plumbing path can't sneak
 * a watermark onto an opted-out export.
 */
/**
 * Hardcoded fallback used only when the user enables the watermark
 * but the field is empty AND the caller didn't substitute a localized
 * default. Should never surface in normal UI flows — the config panel
 * passes the locale-aware placeholder when the input is blank.
 */
const FALLBACK_WATERMARK_TEXT = 'PIXFIT · For this application only'

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  mode: OutputMode,
): void {
  if (!config.enabled) return
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
