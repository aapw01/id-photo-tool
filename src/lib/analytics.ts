/**
 * Small, optional GA4 event bridge.
 *
 * The app remains fully functional when no Measurement ID is configured:
 * `trackEvent` simply returns before touching any browser API. Event
 * properties are deliberately limited to primitives so callers cannot
 * accidentally pass a File, Blob, ImageBitmap, ImageData, filename, or
 * EXIF payload to an analytics provider.
 */

export type AnalyticsValue = string | number | boolean
export type AnalyticsProperties = Record<string, AnalyticsValue>

export type AnalyticsEventName =
  | 'upload_succeeded'
  | 'cutout_succeeded'
  | 'export_succeeded'
  | 'scanner_upload_succeeded'
  | 'scanner_rectify_succeeded'
  | 'scanner_export_succeeded'

type Gtag = (
  command: 'config' | 'event' | 'js',
  target: string | Date,
  params?: Record<string, unknown>,
) => void

declare global {
  interface Window {
    gtag?: Gtag
  }
}

/**
 * Return a coarse upload category without exposing the original filename.
 */
export function classifyFileType(file: Pick<File, 'type' | 'name'>): string {
  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime === 'image/heic' || mime === 'image/heif' || /\.(heic|heif)$/.test(name)) {
    return 'heic'
  }
  if (mime.startsWith('image/')) return 'image'
  return 'other'
}

/**
 * Send one low-cardinality event when GA4 is configured and ready.
 * Failures are intentionally swallowed so analytics can never interrupt
 * uploads, image processing, scanning, or exports.
 */
export function trackEvent(name: AnalyticsEventName, properties?: AnalyticsProperties): void {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return
  if (typeof window.gtag !== 'function') return

  try {
    window.gtag('event', name, properties)
  } catch {
    // Analytics is best-effort and must never affect the product flow.
  }
}
