/**
 * Wire protocol between the main thread and the segmentation Web Worker.
 *
 * Every message carries a string `id` so multiple in-flight requests can
 * be multiplexed over a single worker. The main thread bookkeeping lives
 * in src/features/segmentation/use-segmentation.ts (M2-T12).
 *
 * Mirrors the design in docs/TECH_DESIGN.md §6.2.
 */

export type ProgressPhase = 'download' | 'init' | 'infer'
export type Backend = 'webgpu' | 'wasm'

/** Stable error categories surfaced to the UI for i18n routing (T11). */
export type ErrorKind = 'network' | 'integrity' | 'init' | 'inference' | 'unknown'

/** Messages the main thread sends to the worker. */
export type SegmentRequest =
  | { type: 'init'; id: string; forceBackend?: Backend }
  | {
      type: 'segment'
      id: string
      bitmap: ImageBitmap
      /**
       * Ask the worker to also produce a decontaminated foreground RGBA
       * buffer (alpha matte + spill suppression already applied). Lets
       * the main thread skip ~200-400 ms of pixel work on 20MP captures.
       *
       * Defaults to `false` for backward compatibility with existing
       * callers (tests, the perf benchmark page).
       */
      withForeground?: boolean
      /**
       * Long-side cap for the foreground buffer when `withForeground`
       * is true. Defaults to `DEFAULT_FOREGROUND_MAX_LONGSIDE` (1600 px)
       * to match `extractForegroundCapped`'s working canvas size.
       */
      foregroundMaxLongSide?: number
    }

/** Messages the worker posts back to the main thread. */
export type SegmentResponse =
  | { type: 'ready'; id: string; backend: Backend }
  | {
      type: 'progress'
      id: string
      phase: ProgressPhase
      loaded?: number
      total?: number
    }
  | {
      type: 'result'
      id: string
      mask: ArrayBuffer
      width: number
      height: number
      backend: Backend
      durationMs: number
      /**
       * Optional decontaminated foreground buffer (RGBA, premultiplied
       * by the alpha matte and spill-suppressed). Present only when the
       * matching request set `withForeground: true`. `foregroundWidth`
       * and `foregroundHeight` describe its dimensions; they may be
       * smaller than `width`/`height` when the long-side cap kicked in.
       */
      foreground?: ArrayBuffer
      foregroundWidth?: number
      foregroundHeight?: number
    }
  | { type: 'error'; id: string; reason: string; kind: ErrorKind }

/** Default long-side cap for worker-produced foregrounds. */
export const DEFAULT_FOREGROUND_MAX_LONGSIDE = 1600

/**
 * Type guards — handy for narrowing in tests and in the host hook.
 */

export function isResponse(value: unknown): value is SegmentResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { type?: unknown; id?: unknown }
  return typeof v.type === 'string' && typeof v.id === 'string'
}

export function isFinalResponse(
  msg: SegmentResponse,
): msg is Extract<SegmentResponse, { type: 'result' | 'error' }> {
  return msg.type === 'result' || msg.type === 'error'
}
