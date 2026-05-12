/**
 * High-quality image resampling — the Pica wrapper.
 *
 * Canvas's native `drawImage` is fast but uses a triangle / Mitchell
 * filter that softens edges, especially for ID-photo downscales where
 * we lose facial detail. Pica wraps a real Lanczos / Catmull-Rom
 * filter and falls back to WebGL / OffscreenCanvas where available.
 *
 * The module is intentionally lazy: Pica weighs ~30 KB gzipped and
 * pulls in a Web Worker, so we only construct the singleton when
 * `resample()` is first called. M5 export panel uses it for the
 * final spec-sized blob; the preview canvas still uses drawImage for
 * snappiness.
 */

type PicaInstance = {
  resize: (
    from: HTMLCanvasElement,
    to: HTMLCanvasElement,
    opts?: { quality?: number },
  ) => Promise<HTMLCanvasElement>
}

export interface ResampleOptions {
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas
  targetWidth: number
  targetHeight: number
  /** 0 = nearest neighbour … 3 = high-quality Lanczos. Default 3. */
  quality?: 0 | 1 | 2 | 3
}

let picaInstance: PicaInstance | null = null

/**
 * Lazily build a single Pica instance. Re-using one means worker
 * threads are shared across requests; building a new one per call
 * leaks file handles in tests.
 */
async function getPica(): Promise<PicaInstance> {
  if (picaInstance) return picaInstance
  const mod = await import('pica')
  // Default export under both ESM and CJS shapes.
  const factory =
    (mod as { default?: () => PicaInstance }).default ?? (mod as unknown as () => PicaInstance)
  picaInstance = factory()
  return picaInstance
}

/**
 * Resample `source` into a fresh canvas at `targetWidth × targetHeight`
 * using Pica's Lanczos filter. Returns the canvas (DOM-backed) so the
 * caller can read pixels, convert to blob, or compose on top of it.
 *
 * When Pica isn't available (SSR, weird sandboxes) we fall back to
 * the native canvas resampler so the call never throws.
 */
export async function resample({
  source,
  targetWidth,
  targetHeight,
  quality = 3,
}: ResampleOptions): Promise<HTMLCanvasElement> {
  const target = document.createElement('canvas')
  target.width = Math.max(1, Math.round(targetWidth))
  target.height = Math.max(1, Math.round(targetHeight))

  const src = await toHtmlCanvas(source)

  try {
    const pica = await getPica()
    await pica.resize(src, target, { quality })
    return target
  } catch {
    return nativeResample(src, target)
  }
}

/** Native fallback — used when Pica fails to load. */
function nativeResample(src: HTMLCanvasElement, target: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = target.getContext('2d')
  if (!ctx) return target
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, target.width, target.height)
  return target
}

/**
 * Pica requires HTMLCanvas* on both sides. Wrap `ImageBitmap` /
 * `OffscreenCanvas` inputs into a DOM canvas with a single
 * drawImage so the resampler can read pixel data.
 */
async function toHtmlCanvas(
  src: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
): Promise<HTMLCanvasElement> {
  if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) {
    return src
  }
  const c = document.createElement('canvas')
  c.width = (src as ImageBitmap).width
  c.height = (src as ImageBitmap).height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('resample: 2D context unavailable')
  ctx.drawImage(src as unknown as CanvasImageSource, 0, 0)
  return c
}

/**
 * Test seam — clears the cached Pica singleton so unit tests can
 * inject their own behaviour without leaking state across cases.
 */
export function __resetPicaForTesting(): void {
  picaInstance = null
}
