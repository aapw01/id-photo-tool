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
 * Runtime init: OpenCV.js's WASM runtime initializes asynchronously
 * after the JS finishes parsing — even after `script.onload` the
 * `cv.Mat` constructor is sometimes still undefined. We use the
 * documented pattern: `cv` is a Promise (or thenable) that resolves
 * to the cv module once everything is ready. We additionally guard
 * with a poll-and-timeout for builds that don't expose the thenable.
 *
 * `loadOpenCV()` returns a singleton promise. Subsequent calls reuse
 * it — the script tag is only ever appended once.
 *
 * Failure model: rejection with a typed `OpenCVLoadError` so the UI
 * can render a localized retry CTA.
 */

const OPENCV_VERSION = '4.10.0'
const OPENCV_URL = `https://docs.opencv.org/${OPENCV_VERSION}/opencv.js`

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
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${OPENCV_URL}"]`)

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

    if (existingScript) {
      // Script tag is already in the document (e.g. another instance of
      // this loader was kicked off first) — wait on the runtime poll.
      finalize()
      return
    }

    const script = document.createElement('script')
    script.src = OPENCV_URL
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = finalize
    script.onerror = () => {
      reject(
        new OpenCVLoadError(
          'script_failed',
          `Failed to load OpenCV.js from ${OPENCV_URL} — check the network`,
        ),
      )
    }
    document.head.appendChild(script)
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

export { OPENCV_URL, OPENCV_VERSION }
