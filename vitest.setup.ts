import '@testing-library/jest-dom/vitest'

// happy-dom ships an HTMLCanvasElement *node*, but `getContext('2d')`
// returns null and `toBlob` is missing. The export pipeline only needs
// the call-shape (it never inspects pixel bytes in unit tests), so we
// install a minimal stub: a noop 2D context plus a `toBlob` that emits
// a typed Blob of the requested mime type. Anything that relies on
// real pixel data must mock at a higher level.
const Canvas = (globalThis as { HTMLCanvasElement?: typeof HTMLCanvasElement }).HTMLCanvasElement
if (Canvas) {
  const proto = Canvas.prototype as unknown as {
    getContext: (kind: string) => unknown
    toBlob: (cb: (blob: Blob | null) => void, mime?: string, quality?: number) => void
    convertToBlob?: (opts?: { type?: string; quality?: number }) => Promise<Blob>
  }
  // Cache the stub context per canvas so multiple `getContext('2d')`
  // calls return the same recorded-call list (matches real canvas
  // behaviour and lets tests inspect what was drawn).
  const ctxCache = new WeakMap<HTMLCanvasElement, StubContext>()
  proto.getContext = function (kind: string) {
    if (kind !== '2d') return null
    const canvas = this as unknown as HTMLCanvasElement
    let ctx = ctxCache.get(canvas)
    if (!ctx) {
      ctx = makeStubContext()
      ctxCache.set(canvas, ctx)
    }
    return ctx
  }
  proto.toBlob = function (
    cb: (blob: Blob | null) => void,
    mime: string = 'image/png',
    quality?: number,
  ) {
    // Mimic an encoder by emitting a payload whose size scales with
    // the canvas pixels and the requested quality. The byte values
    // are not meaningful — only `blob.type` and `blob.size` are read
    // by the tests.
    const w = (this as unknown as HTMLCanvasElement).width || 1
    const h = (this as unknown as HTMLCanvasElement).height || 1
    const q = quality ?? (mime === 'image/jpeg' ? 0.92 : mime === 'image/webp' ? 0.85 : 1)
    const size = Math.max(64, Math.round(w * h * (0.05 * q + 0.01)))
    const bytes = new Uint8Array(size)
    setTimeout(() => cb(new Blob([bytes], { type: mime })), 0)
  }
}

type StubContext = Record<string, unknown> & {
  __drawCalls: { method: string; args: unknown[] }[]
}

/**
 * Tests that need to inspect cross-canvas draw activity (e.g. confirm
 * a watermark composed glyphs onto a transient canvas owned by
 * `renderOutputMode`) can read this registry. Reset it at the start
 * of any test that asserts on draw counts so prior tests' contexts
 * don't bleed in.
 */
const stubCtxRegistry: StubContext[] = []
;(globalThis as { __stubCtxRegistry?: StubContext[] }).__stubCtxRegistry = stubCtxRegistry

function makeStubContext(): StubContext {
  const calls: StubContext['__drawCalls'] = []
  const proxy: StubContext = new Proxy(
    {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      globalCompositeOperation: 'source-over',
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      __drawCalls: calls,
    } as StubContext,
    {
      get(target, prop) {
        if (prop in target) return (target as Record<PropertyKey, unknown>)[prop]
        if (prop === 'getImageData') {
          return (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
            colorSpace: 'srgb' as const,
          })
        }
        if (prop === 'createImageData') {
          return (w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
            colorSpace: 'srgb' as const,
          })
        }
        if (prop === 'measureText') {
          return (text: string) => {
            calls.push({ method: 'measureText', args: [text] })
            // Approximate metric — `drawWatermark` only reads `width`
            // to compute its grid step, so a coarse linear estimate is
            // enough to exercise the tiling loop without a real font.
            return { width: text.length * 6 } as TextMetrics
          }
        }
        // Every other method is a recorded noop. Tests inspect
        // `ctx.__drawCalls` to assert what got drawn.
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args })
          return undefined
        }
      },
      set(target, prop, value) {
        ;(target as Record<PropertyKey, unknown>)[prop] = value
        return true
      },
    },
  )
  stubCtxRegistry.push(proxy)
  return proxy
}

// happy-dom doesn't provide `createImageBitmap`; some helpers want it.
// Treat it as a no-op identity function so tests can keep passing
// HTMLCanvasElement / Blob fixtures.
if (typeof globalThis.createImageBitmap === 'undefined') {
  Object.defineProperty(globalThis, 'createImageBitmap', {
    value: async (src: unknown) => src as ImageBitmap,
    configurable: true,
  })
}

// happy-dom doesn't expose `ImageData` as a global. The mask helpers
// construct it directly to pass to compositing / scanning utilities,
// so install a minimal class-shaped shim. Matches the Web IDL surface
// the helpers touch (`data`, `width`, `height`).
if (typeof (globalThis as { ImageData?: unknown }).ImageData === 'undefined') {
  class ImageDataShim {
    readonly data: Uint8ClampedArray
    readonly width: number
    readonly height: number
    readonly colorSpace = 'srgb' as const
    constructor(data: Uint8ClampedArray | number, width?: number, height?: number) {
      if (typeof data === 'number') {
        // ImageData(width, height) — synthesise zero-filled bytes.
        this.width = data
        this.height = width ?? 0
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else {
        if (width === undefined) {
          throw new TypeError('ImageData shim requires a width when data is provided')
        }
        this.data = data
        this.width = width
        this.height = height ?? data.length / (4 * width)
      }
    }
  }
  Object.defineProperty(globalThis, 'ImageData', {
    value: ImageDataShim,
    configurable: true,
    writable: true,
  })
}

// Node 26+ gates Web Storage behind --localstorage-file. Tests rely on
// the synchronous API for cache logic, so install an in-memory shim
// when the runtime does not expose one.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private map = new Map<string, string>()
    get length(): number {
      return this.map.size
    }
    clear(): void {
      this.map.clear()
    }
    getItem(key: string): string | null {
      return this.map.has(key) ? this.map.get(key)! : null
    }
    key(index: number): string | null {
      return Array.from(this.map.keys())[index] ?? null
    }
    removeItem(key: string): void {
      this.map.delete(key)
    }
    setItem(key: string, value: string): void {
      this.map.set(key, String(value))
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  })
}
