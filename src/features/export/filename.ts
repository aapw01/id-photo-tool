/**
 * Filename builder for the three export kinds in PRD §5.8.4:
 *
 *   - single      `{photoSpecId}_{w}x{h}_{YYYYMMDD}.{ext}`
 *   - compressed  `{photoSpecId}_{w}x{h}_{targetKB}KB_{YYYYMMDD}.{ext}`
 *   - layout      `layout_{templateId}_{paperId}_{YYYYMMDD}.{ext}`
 *
 * The function is intentionally pure — the call site decides the date
 * (so previews stay stable inside a render) and the resolved pixel
 * size (M5 may downscale for compressed JPGs). When a `PhotoSpec` is
 * not present (e.g. user is on the export tab without picking a spec
 * yet) we fall back to the project shorthand `pixfit`.
 */

import { derivePixels } from '@/lib/spec-units'
import type { PhotoSpec } from '@/types/spec'

export type ExportExt = 'png' | 'jpg' | 'jpeg' | 'webp' | 'pdf'

interface SingleOpts {
  kind: 'single'
  spec: PhotoSpec | null
  ext: ExportExt
  /** Override the resolved size — useful when the export pipeline
   * downscales (compressed) or matches the source bitmap. */
  width?: number
  height?: number
  date?: Date
}

interface CompressedOpts {
  kind: 'compressed'
  spec: PhotoSpec | null
  ext: ExportExt
  targetKB: number
  width?: number
  height?: number
  date?: Date
}

interface LayoutOpts {
  kind: 'layout'
  templateId: string
  paperId: string
  ext: ExportExt
  date?: Date
}

export type FilenameOpts = SingleOpts | CompressedOpts | LayoutOpts

export function buildFilename(opts: FilenameOpts): string {
  const date = formatDate(opts.date ?? new Date())
  switch (opts.kind) {
    case 'single': {
      const { width, height } = resolveSize(opts)
      const prefix = opts.spec ? sanitize(opts.spec.id) : 'pixfit'
      return `${prefix}_${width}x${height}_${date}.${opts.ext}`
    }
    case 'compressed': {
      const { width, height } = resolveSize(opts)
      const prefix = opts.spec ? sanitize(opts.spec.id) : 'pixfit'
      return `${prefix}_${width}x${height}_${opts.targetKB}KB_${date}.${opts.ext}`
    }
    case 'layout':
      return `layout_${sanitize(opts.templateId)}_${sanitize(opts.paperId)}_${date}.${opts.ext}`
  }
}

function resolveSize(opts: SingleOpts | CompressedOpts): { width: number; height: number } {
  if (opts.width && opts.height) return { width: opts.width, height: opts.height }
  if (opts.spec) {
    const r = derivePixels(opts.spec)
    return { width: r.width_px, height: r.height_px }
  }
  return { width: 0, height: 0 }
}

/**
 * Strip characters that don't belong in a filename. Anything outside
 * `[A-Za-z0-9-_]` collapses to `_` so user-imported spec ids with
 * spaces or Unicode glyphs still produce a sane download name.
 */
function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, '_') || 'spec'
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}
