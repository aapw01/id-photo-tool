/**
 * Upload pipeline for the Scanner — turn a user-picked `File` into a
 * decoded, orientation-corrected `ImageBitmap` ready for perspective
 * correction (S3+).
 *
 * Responsibilities:
 *
 *   1. Size / type validation — fail fast with a typed error so the
 *      UI can show a localized toast.
 *   2. HEIC fallback — Safari can decode HEIC natively but Chrome /
 *      Firefox cannot. We sniff HEIC by MIME (`image/heic` /
 *      `image/heif`) and filename (`.heic` / `.heif`), then lazy-load
 *      `heic2any` (~3 MB once libheif-js is pulled) to convert the
 *      bytes into a JPEG blob. The library is a *dynamic import* so
 *      it never lands in the initial Scanner bundle — non-iOS users
 *      pay nothing for HEIC support.
 *   3. PDF fallback — V1 accepts single-page PDFs. We sniff PDF by
 *      MIME (`application/pdf`) or filename (`.pdf`), then lazy-load
 *      the `pdf-load` helper (which itself dynamic-imports pdfjs-dist
 *      + its worker bundle). Page 1 is rendered to a 300-DPI PNG and
 *      handed downstream as if it were a JPG upload. The slot
 *      preserves the source page count so the UI can surface a
 *      "page 1 of N" notice for multi-page docs.
 *   4. Decode via `createImageBitmap` with `imageOrientation:
 *      'from-image'` so EXIF orientation tags from camera apps are
 *      baked into the bitmap. Everything downstream can assume the
 *      pixel grid is upright.
 *
 * The caller owns the returned `ImageBitmap` — closing it is its
 * responsibility (the Scanner store does this when the slot is
 * cleared or replaced).
 */

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|pdf)$/i

const HEIC_HINT = /\.(heic|heif)$/i
const PDF_HINT = /\.pdf$/i

/**
 * Reject files larger than 20 MB. iPhone HEIC originals run ~2-4 MB,
 * Android JPEGs at full DSLR resolution top out around 12 MB, so
 * 20 MB is a generous cap that still keeps a single decoded
 * `ImageBitmap` under the per-tab GPU texture budget on most
 * devices.
 */
const MAX_BYTES = 20 * 1024 * 1024

export type DocumentUploadErrorCode =
  | 'unsupported_type'
  | 'too_large'
  | 'heic_convert_failed'
  | 'pdf_decode_failed'
  | 'decode_failed'

export class DocumentUploadError extends Error {
  readonly code: DocumentUploadErrorCode
  readonly fileName?: string

  constructor(code: DocumentUploadErrorCode, message: string, fileName?: string) {
    super(message)
    this.name = 'DocumentUploadError'
    this.code = code
    this.fileName = fileName
  }
}

export interface LoadedDocumentImage {
  /** Original user upload — kept so the UI can show name + size. */
  file: File
  /** Decoded bitmap, EXIF orientation already applied. */
  bitmap: ImageBitmap
  /**
   * The bytes we actually decoded. When the upload was HEIC this is
   * the converted JPEG; when it was a PDF this is the rendered PNG of
   * page 1; otherwise it points at the original file. Downstream
   * code that needs to re-encode (e.g. PDF embedding in S5) can use
   * this directly instead of re-rendering the bitmap.
   */
  blob: Blob
  /** True iff `blob` is the heic2any output, not the original file. */
  convertedFromHeic: boolean
  /** True iff `blob` is the rendered PNG of a PDF page, not the original file. */
  convertedFromPdf: boolean
  /**
   * Total pages in the source PDF (1 for single-page docs).
   * `undefined` for non-PDF uploads.
   */
  sourcePageCount: number | undefined
  /** Detected MIME used for the final decode (post HEIC / PDF conversion). */
  decodedMime: string
}

function isHeic(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif' || HEIC_HINT.test(file.name)
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || PDF_HINT.test(file.name)
}

function hasAllowedShape(file: File): boolean {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true
  // Some OS / browsers (notably Safari with HEIC) leave `file.type`
  // empty — fall back to extension.
  return ALLOWED_EXTENSIONS.test(file.name)
}

/**
 * Lazy-loaded HEIC → JPEG converter. `heic2any` is wrapped so the
 * library only enters the bundle for users that actually drop a
 * HEIC file. Returns a `Blob` of `image/jpeg` bytes.
 */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  // heic2any has loose typings; we narrow them here so the rest of
  // the module sees a tight signature.
  const mod = (await import('heic2any')) as {
    default: (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>
  }
  const out = await mod.default({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  return Array.isArray(out) ? out[0]! : out
}

interface PdfRenderOutput {
  blob: Blob
  sourcePageCount: number
}

/**
 * Lazy-loaded PDF page 1 → PNG renderer. Indirected through a module
 * binding so tests can swap in a fake without having to instantiate
 * the real pdfjs-dist worker. See `pdf-load.ts` for the worker
 * registration + viewport math.
 */
let renderPdfImpl: ((bytes: ArrayBuffer) => Promise<PdfRenderOutput>) | null = null

async function renderPdfFirstPage(bytes: ArrayBuffer): Promise<PdfRenderOutput> {
  if (!renderPdfImpl) {
    const mod = await import('./pdf-load')
    renderPdfImpl = mod.renderPdfFirstPageToBlob
  }
  return renderPdfImpl(bytes)
}

/**
 * Test seam: replace the PDF renderer with a stub so unit tests can
 * exercise the rest of `loadDocumentImage` without booting pdfjs
 * inside happy-dom. Restoring with `null` re-enables the real lazy
 * loader on the next call.
 */
export function __setPdfRendererForTests(
  impl: ((bytes: ArrayBuffer) => Promise<PdfRenderOutput>) | null,
): void {
  renderPdfImpl = impl
}

/**
 * Decode a user-picked file into an `ImageBitmap`. Throws a typed
 * `DocumentUploadError` on any failure so callers can localize the
 * message.
 *
 * @example
 *   try {
 *     const { bitmap } = await loadDocumentImage(file)
 *     scanner.setFront(file, bitmap)
 *   } catch (err) {
 *     if (err instanceof DocumentUploadError) {
 *       toast.error(t(`Scanner.upload.errors.${err.code}`))
 *     }
 *   }
 */
export async function loadDocumentImage(file: File): Promise<LoadedDocumentImage> {
  if (file.size > MAX_BYTES) {
    throw new DocumentUploadError(
      'too_large',
      `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB (limit 20 MB)`,
      file.name,
    )
  }

  if (!hasAllowedShape(file)) {
    throw new DocumentUploadError(
      'unsupported_type',
      `${file.name} (${file.type || 'unknown type'}) is not a supported image format`,
      file.name,
    )
  }

  let blob: Blob = file
  let convertedFromHeic = false
  let convertedFromPdf = false
  let sourcePageCount: number | undefined
  if (isHeic(file)) {
    try {
      blob = await convertHeicToJpeg(file)
      convertedFromHeic = true
    } catch (err) {
      throw new DocumentUploadError(
        'heic_convert_failed',
        err instanceof Error ? err.message : String(err),
        file.name,
      )
    }
  } else if (isPdf(file)) {
    try {
      const buffer = await file.arrayBuffer()
      const rendered = await renderPdfFirstPage(buffer)
      blob = rendered.blob
      convertedFromPdf = true
      sourcePageCount = rendered.sourcePageCount
    } catch (err) {
      throw new DocumentUploadError(
        'pdf_decode_failed',
        err instanceof Error ? err.message : String(err),
        file.name,
      )
    }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
    })
  } catch (err) {
    throw new DocumentUploadError(
      'decode_failed',
      err instanceof Error ? err.message : String(err),
      file.name,
    )
  }

  const decodedMime = convertedFromHeic
    ? 'image/jpeg'
    : convertedFromPdf
      ? 'image/png'
      : file.type || 'application/octet-stream'

  return {
    file,
    bitmap,
    blob,
    convertedFromHeic,
    convertedFromPdf,
    sourcePageCount,
    decodedMime,
  }
}

// Re-exported so tests can assert against the actual values without
// re-declaring them.
export const SCANNER_UPLOAD_LIMITS = {
  maxBytes: MAX_BYTES,
  allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  allowedExtensionPattern: ALLOWED_EXTENSIONS,
} as const
