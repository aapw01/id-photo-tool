'use client'

/**
 * PDF page 1 → PNG blob helper. Split out from `load-document-image`
 * so:
 *
 *   1. The pdfjs-dist module (~1 MB after gzip) is *only* pulled in
 *      when the user actually drops a PDF. Non-PDF flows keep the
 *      Scanner shell's initial bundle small.
 *   2. Tests can stub `renderPdfFirstPageToBlob` directly without
 *      having to mock the full pdfjs-dist surface — happy-dom doesn't
 *      ship a usable PDF.js runtime, and pulling the real worker
 *      under vitest is overkill for what we need to assert.
 *
 * The first call lazily loads `pdfjs-dist` and registers the
 * `GlobalWorkerOptions.workerSrc` from `node_modules/pdfjs-dist/build/
 * pdf.worker.min.mjs` via `new URL(..., import.meta.url)`. Turbopack
 * (Next 16) resolves that pattern to a fingerprinted asset URL at
 * build time, so the worker is delivered with the rest of the
 * static output.
 *
 * Single-page in V1: we render page 1 at ~300 DPI (`scale = 300 / 72`,
 * since pdfjs uses 72 DPI as the page-unit baseline). Multi-page
 * PDFs return their page count via `sourcePageCount` so the upload
 * UI can surface a "using page 1 of N" notice; a future revision can
 * upgrade this to a page picker without churning the loader API.
 */

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

const PDF_TARGET_DPI = 300
const PDF_BASELINE_DPI = 72
const PDF_RENDER_SCALE = PDF_TARGET_DPI / PDF_BASELINE_DPI

export interface PdfRenderResult {
  /** Rendered PNG of page 1 — same shape downstream as an image upload. */
  blob: Blob
  /** Total pages in the source PDF (1 for single-page docs). */
  sourcePageCount: number
  /** Rendered pixel dimensions of page 1. */
  width: number
  height: number
}

// `pdfjs-dist`'s entry surface (typing the bits we touch).
interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> }
}

let pdfJsPromise: Promise<PdfJsModule> | null = null

/**
 * Lazy-load pdfjs-dist exactly once per page lifetime. The worker
 * URL is registered the first time through; subsequent calls reuse
 * the cached module so we don't re-execute the worker registration.
 */
async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      const mod = (await import('pdfjs-dist')) as unknown as PdfJsModule
      // Turbopack / Webpack 5 understand this `new URL(..., import.meta.url)`
      // pattern and emit the worker as a static asset alongside the
      // bundle. The fallback `.toString()` is what gets handed to
      // pdfjs's `Worker(workerSrc)` constructor.
      mod.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
      return mod
    })()
  }
  return pdfJsPromise
}

/**
 * Render the first page of `pdfBytes` to a PNG blob, returning the
 * blob plus the source page count so the UI can surface a "page 1 of
 * N" notice for multi-page PDFs.
 *
 * Throws any pdfjs decode error verbatim — the caller wraps it in a
 * typed `DocumentUploadError('pdf_decode_failed', ...)`.
 */
export async function renderPdfFirstPageToBlob(pdfBytes: ArrayBuffer): Promise<PdfRenderResult> {
  const pdfjsLib = await getPdfJs()
  // pdfjs mutates the buffer it receives — pass a copy so callers can
  // keep using the original (e.g. for downstream stash / debug).
  const data = pdfBytes.slice(0)
  const doc: PDFDocumentProxy = await pdfjsLib.getDocument({ data }).promise
  try {
    const sourcePageCount = doc.numPages
    const page: PDFPageProxy = await doc.getPage(1)
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
    const width = Math.max(1, Math.round(viewport.width))
    const height = Math.max(1, Math.round(viewport.height))

    // pdfjs 5's render API takes an `HTMLCanvasElement`; OffscreenCanvas
    // is not currently a first-class target so we render into a regular
    // `<canvas>` here. The Scanner loader is already client-only, so
    // touching `document` is fine.
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    await page.render({ canvas, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error('renderPdfFirstPageToBlob: toBlob returned null')),
        'image/png',
      )
    })
    return { blob, sourcePageCount, width, height }
  } finally {
    // `destroy` releases pdfjs's parsed structures + worker memory.
    await doc.destroy()
  }
}
