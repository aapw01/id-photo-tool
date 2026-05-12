/**
 * Background compositing — the heart of M3.
 *
 * Two complementary functions:
 *
 *   - `compositeIntoImageData(orig, mask, bg, out?)` is a pure pixel-
 *     space function. Mask alpha is multiplied into the original alpha,
 *     and a solid-color background (if any) is alpha-blended underneath.
 *     Easy to unit-test, no DOM needed.
 *
 *   - `extractForeground(bitmap, maskImageData)` and `compositeOnto(
 *     ctx, foreground, bg)` are the canvas-2D helpers used by the live
 *     preview. They cache the "subject cut out on transparent" bitmap
 *     so flipping the background colour is just a pair of `drawImage`
 *     calls — the destination-in cut-out is paid once.
 *
 * Performance contract (TECH_DESIGN §5.3.3): a background swap should
 * cost < 30 ms on commodity hardware; the cached-foreground path keeps
 * it well under that.
 */

import { decontaminateEdges } from '@/features/segmentation/postprocess'

/** A background choice: either transparent or a CSS hex colour. */
export type BgColor = { kind: 'transparent' } | { kind: 'color'; hex: string }

const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/**
 * Parse `#RGB`, `#RRGGBB`, `RGB`, or `RRGGBB` into an {r, g, b} triple.
 * Returns null when the input is not a valid hex colour — callers should
 * fall back to transparent or surface a UI error.
 */
export function parseHex(input: string): { r: number; g: number; b: number } | null {
  const trimmed = input.trim()
  const m6 = HEX6.exec(trimmed)
  if (m6) {
    return {
      r: parseInt(m6[1]!, 16),
      g: parseInt(m6[2]!, 16),
      b: parseInt(m6[3]!, 16),
    }
  }
  const m3 = HEX3.exec(trimmed)
  if (m3) {
    return {
      r: parseInt(m3[1]! + m3[1]!, 16),
      g: parseInt(m3[2]! + m3[2]!, 16),
      b: parseInt(m3[3]! + m3[3]!, 16),
    }
  }
  return null
}

/** Format `{r,g,b}` back to `#RRGGBB`. */
export function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const pad = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${pad(r)}${pad(g)}${pad(b)}`
}

/**
 * Pixel-space composite. Both buffers must already be the same WxH.
 *
 * For each pixel:
 *   final_alpha = orig.A · mask.A / 255
 *
 *   - bg=transparent → output keeps (orig.RGB, final_alpha)
 *   - bg=color       → blend over solid (bgR, bgG, bgB) at final_alpha;
 *                       output alpha is 255 (fully opaque)
 *
 * Mutates `out` in place when supplied, otherwise allocates a fresh
 * Uint8ClampedArray. Returning the buffer lets callers chain.
 */
export function compositeIntoImageData(
  orig: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  bg: BgColor,
  out?: Uint8ClampedArray,
): Uint8ClampedArray {
  if (orig.length !== mask.length) {
    throw new Error(`composite: mismatched buffers (orig=${orig.length}, mask=${mask.length})`)
  }
  const dst = out ?? new Uint8ClampedArray(orig.length)
  if (dst.length !== orig.length) {
    throw new Error(`composite: out buffer length mismatch (${dst.length})`)
  }

  if (bg.kind === 'transparent') {
    for (let i = 0; i < orig.length; i += 4) {
      dst[i] = orig[i]!
      dst[i + 1] = orig[i + 1]!
      dst[i + 2] = orig[i + 2]!
      const origA = orig[i + 3] ?? 0
      const maskA = mask[i + 3] ?? 0
      dst[i + 3] = Math.round((origA * maskA) / 255)
    }
    return dst
  }

  const rgb = parseHex(bg.hex)
  if (!rgb) {
    throw new Error(`composite: invalid hex "${bg.hex}"`)
  }
  for (let i = 0; i < orig.length; i += 4) {
    const origR = orig[i]!
    const origG = orig[i + 1]!
    const origB = orig[i + 2]!
    const origA = orig[i + 3] ?? 0
    const maskA = mask[i + 3] ?? 0
    // Normalize once; multiplying then dividing twice loses precision.
    const a = (origA * maskA) / (255 * 255)
    const inv = 1 - a
    dst[i] = Math.round(origR * a + rgb.r * inv)
    dst[i + 1] = Math.round(origG * a + rgb.g * inv)
    dst[i + 2] = Math.round(origB * a + rgb.b * inv)
    dst[i + 3] = 255
  }
  return dst
}

/* -------------------------------------------------------------------------- */
/* Canvas helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cut the original `bitmap` out by `maskImage` (RGBA where A is the
 * matte) into a fresh ImageBitmap. This bitmap is the cacheable
 * intermediate: every later swap of background colour reuses it.
 *
 * Implementation uses `destination-in` which is GPU-friendly and lets
 * the browser keep the result on the compositor. We pick OffscreenCanvas
 * when available (Workers + modern browsers) and fall back to a regular
 * HTMLCanvasElement otherwise.
 */
export async function extractForeground(
  bitmap: ImageBitmap,
  maskImage: ImageData,
): Promise<ImageBitmap> {
  const { width: w, height: h } = bitmap
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('extractForeground: 2D context unavailable')

  ctx.drawImage(bitmap, 0, 0)

  // Stamp the mask via destination-in. The mask may differ in size if
  // the model emitted a different resolution, but the studio's
  // postprocess pipeline guarantees orig == mask dimensions.
  const maskCanvas = makeCanvas(maskImage.width, maskImage.height)
  const maskCtx = maskCanvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!maskCtx) throw new Error('extractForeground: mask 2D context unavailable')
  maskCtx.putImageData(maskImage, 0, 0)

  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(maskCanvas as unknown as CanvasImageSource, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  // Decontaminate the soft alpha ring: `destination-in` keeps the
  // original photo's RGB for semi-transparent edge pixels, which on
  // busy / coloured backgrounds means the old bg colour bleeds through
  // as a visible halo around the hair. `decontaminateEdges` samples
  // the outer ring of low-alpha-but-near-subject pixels for the bg
  // estimate, then unmixes that colour from every semi-alpha pixel.
  // No-op when the buffer doesn't have a clean outer ring (e.g.
  // photos shot against a gradient or already on transparent).
  try {
    const imgData = ctx.getImageData(0, 0, w, h)
    decontaminateEdges(imgData.data, w, h)
    ctx.putImageData(imgData, 0, 0)
  } catch {
    // Some canvases (tainted, restricted offscreen) refuse getImageData;
    // in that case we keep the raw destination-in output. The visible
    // halo is the same as before this pass landed — not a regression.
  }

  if (canvas instanceof OffscreenCanvas) {
    return canvas.transferToImageBitmap()
  }
  return createImageBitmap(canvas as HTMLCanvasElement)
}

/**
 * Paint `foreground` over `bg` into the supplied 2D context. The
 * context must already be sized to `(w, h)`. The transparent path
 * clears the canvas; the colour path fills first and then stamps the
 * cached foreground on top — two draw calls regardless of image size.
 */
export function compositeOnto(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  foreground: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  w: number,
  h: number,
  bg: BgColor,
): void {
  ctx.clearRect(0, 0, w, h)
  if (bg.kind === 'color') {
    const rgb = parseHex(bg.hex)
    if (rgb) {
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
      ctx.fillRect(0, 0, w, h)
    }
  }
  ctx.drawImage(foreground as CanvasImageSource, 0, 0, w, h)
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
