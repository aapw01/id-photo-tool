'use client'

/**
 * OpenCV.js singleton loader.
 *
 * OpenCV.js is shipped as an ~8 MB `opencv.js` bundle that registers
 * itself on `window.cv`. We don't want it in the initial Scanner
 * bundle (most landings won't run a rectify), so it's pulled in lazily
 * on demand via a `<script>` tag inserted into the document head.
 *
 * Version: **4.10.0** (Q3 from PRD §14.3) — pinned so behavior is
 * deterministic across rebuilds, and so the `Cache Storage`-backed
 * HTTP cache the browser sets up automatically can survive new
 * minor releases of the Scanner without redownloading the WASM.
 *
 * Hosting: we self-host the bundle at `/vendor/opencv/<ver>/opencv.js`
 * (downloaded at build/dev time via `pnpm opencv:fetch`). This keeps
 * the script same-origin so it works on locked-down networks and
 * doesn't depend on docs.opencv.org, which is intermittently
 * unreachable from mainland China dev environments. If the same-origin
 * file is missing (e.g. someone forgot to run the fetch script in a
 * fresh checkout), we fall back to jsdelivr's `@techstark/opencv-js`
 * mirror — its `dist/opencv.js` is the same upstream artifact.
 *
 * Runtime init: OpenCV.js's WASM runtime initializes asynchronously
 * after the JS finishes parsing — even after `script.onload` the
 * `cv.Mat` constructor is sometimes still undefined. We use the
 * documented pattern: `cv` is a Promise (or thenable) that resolves
 * to the cv module once everything is ready. We additionally guard
 * with a poll-and-timeout for builds that don't expose the thenable.
 *
 * `loadOpenCV()` returns a singleton promise. Subsequent calls reuse
 * it — the script tag is only ever appended once per attempt.
 *
 * Failure model: rejection with a typed `OpenCVLoadError` so the UI
 * can render a localized retry CTA.
 */

const OPENCV_VERSION = '4.10.0'
const OPENCV_URLS = [
  `/vendor/opencv/${OPENCV_VERSION}/opencv.js`,
  `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@${OPENCV_VERSION}/dist/opencv.js`,
] as const
const OPENCV_URL = OPENCV_URLS[0]

const RUNTIME_INIT_TIMEOUT_MS = 30_000
const RUNTIME_POLL_INTERVAL_MS = 50

export type OpenCVLoadErrorCode = 'script_failed' | 'runtime_timeout' | 'runtime_missing'

export class OpenCVLoadError extends Error {
  readonly code: OpenCVLoadErrorCode

  constructor(code: OpenCVLoadErrorCode, message: string) {
    super(message)
    this.name = 'OpenCVLoadError'
    this.code = code
  }
}

/**
 * Loose interop type — OpenCV.js's typings are not first-party for
 * the WASM build. We expose just enough surface area here to type
 * `detect-corners.ts` and `warp-perspective.ts`; everything is cast
 * to `unknown`-safe shapes at the boundary.
 */
export interface OpenCV {
  // Constructors / classes
  Mat: new (...args: unknown[]) => CVMat
  MatVector: new () => CVMatVector
  Point: new (x: number, y: number) => CVPoint
  Size: new (w: number, h: number) => CVSize
  Scalar: new (...vals: number[]) => CVScalar

  // Constants
  CV_8UC1: number
  CV_8UC4: number
  CV_32FC2: number

  COLOR_RGBA2GRAY: number
  RETR_EXTERNAL: number
  CHAIN_APPROX_SIMPLE: number
  INTER_LINEAR: number
  BORDER_REPLICATE: number

  // Functions
  imread: (src: HTMLCanvasElement | HTMLImageElement | ImageData) => CVMat
  imshow: (dst: HTMLCanvasElement, mat: CVMat) => void
  cvtColor: (src: CVMat, dst: CVMat, code: number) => void
  GaussianBlur: (src: CVMat, dst: CVMat, ksize: CVSize, sigmaX: number) => void
  Canny: (src: CVMat, dst: CVMat, threshold1: number, threshold2: number) => void
  findContours: (
    src: CVMat,
    contours: CVMatVector,
    hierarchy: CVMat,
    mode: number,
    method: number,
  ) => void
  contourArea: (contour: CVMat) => number
  arcLength: (curve: CVMat, closed: boolean) => number
  approxPolyDP: (curve: CVMat, approx: CVMat, epsilon: number, closed: boolean) => void
  getPerspectiveTransform: (src: CVMat, dst: CVMat) => CVMat
  warpPerspective: (
    src: CVMat,
    dst: CVMat,
    M: CVMat,
    size: CVSize,
    flags?: number,
    borderMode?: number,
    borderValue?: CVScalar,
  ) => void
  matFromArray: (rows: number, cols: number, type: number, data: number[]) => CVMat
}

export interface CVMat {
  cols: number
  rows: number
  data: Uint8Array
  data32S: Int32Array
  data32F: Float32Array
  delete(): void
  size(): CVSize
  copyTo(dst: CVMat): void
  intPtr(row: number, col: number): Int32Array
}

export interface CVMatVector {
  size(): number
  get(i: number): CVMat
  delete(): void
}

export interface CVPoint {
  x: number
  y: number
}

export interface CVSize {
  width: number
  height: number
}

export interface CVScalar {
  // OpenCV.js represents Scalar as an array-like; we only ever
  // construct, never read fields off of it.
  [Symbol.iterator]?: () => Iterator<number>
}

declare global {
  interface Window {
    cv?: OpenCV | (Promise<OpenCV> & Partial<OpenCV>)
  }
}

let cachedPromise: Promise<OpenCV> | null = null

export function loadOpenCV(): Promise<OpenCV> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new OpenCVLoadError('runtime_missing', 'OpenCV requires a browser environment'),
    )
  }

  // Already initialized — fast path.
  const existing = window.cv
  if (existing && isReadyOpenCV(existing)) {
    return Promise.resolve(existing)
  }

  if (cachedPromise) return cachedPromise

  cachedPromise = new Promise<OpenCV>((resolve, reject) => {
    const finalize = () => {
      const start = Date.now()
      const tick = () => {
        const cv = window.cv
        if (cv && isReadyOpenCV(cv)) {
          resolve(cv)
          return
        }
        // Some builds expose `cv` as a thenable that resolves to itself.
        if (cv && typeof (cv as Promise<OpenCV>).then === 'function') {
          ;(cv as Promise<OpenCV>).then(
            (ready) => {
              if (isReadyOpenCV(ready)) {
                window.cv = ready
                resolve(ready)
              } else {
                reject(
                  new OpenCVLoadError(
                    'runtime_missing',
                    'OpenCV initialized but cv.Mat is unavailable',
                  ),
                )
              }
            },
            (err: unknown) => {
              reject(
                new OpenCVLoadError(
                  'runtime_missing',
                  err instanceof Error ? err.message : String(err),
                ),
              )
            },
          )
          return
        }
        if (Date.now() - start > RUNTIME_INIT_TIMEOUT_MS) {
          reject(
            new OpenCVLoadError(
              'runtime_timeout',
              `OpenCV runtime initialization timed out after ${RUNTIME_INIT_TIMEOUT_MS} ms`,
            ),
          )
          return
        }
        setTimeout(tick, RUNTIME_POLL_INTERVAL_MS)
      }
      tick()
    }

    // If any of our candidate scripts already exists in the document
    // (another loader call lost the race), just poll the runtime.
    for (const url of OPENCV_URLS) {
      if (document.querySelector<HTMLScriptElement>(`script[src="${url}"]`)) {
        finalize()
        return
      }
    }

    const tried: string[] = []
    const tryNext = (idx: number) => {
      if (idx >= OPENCV_URLS.length) {
        reject(
          new OpenCVLoadError(
            'script_failed',
            `Failed to load OpenCV.js from any source (${tried.join(', ')}) — check the network`,
          ),
        )
        return
      }
      const url = OPENCV_URLS[idx]
      if (!url) {
        tryNext(idx + 1)
        return
      }
      tried.push(url)
      const script = document.createElement('script')
      script.src = url
      script.async = true
      // Same-origin path doesn't need CORS; remote fallback benefits
      // from `anonymous` so we can use the response from cache.
      if (/^https?:\/\//.test(url)) script.crossOrigin = 'anonymous'
      script.onload = finalize
      script.onerror = () => {
        script.remove()
        tryNext(idx + 1)
      }
      document.head.appendChild(script)
    }
    tryNext(0)
  })

  // If the load fails, allow a retry by clearing the cached promise.
  cachedPromise.catch(() => {
    cachedPromise = null
  })

  return cachedPromise
}

function isReadyOpenCV(
  candidate: OpenCV | (Promise<OpenCV> & Partial<OpenCV>),
): candidate is OpenCV {
  return typeof (candidate as Partial<OpenCV>).Mat === 'function'
}

export { OPENCV_URL, OPENCV_URLS, OPENCV_VERSION }
