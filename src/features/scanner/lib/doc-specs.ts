'use client'

/**
 * DocSpec catalog — physical dimensions of the documents the Scanner
 * can rectify into.
 *
 * V1 ships a tight, deliberately small catalog covering the most
 * common scan targets:
 *
 *   - `cn-id-card` — PRC Resident ID (CR80 / ISO 7810 ID-1, 85.6×54)
 *   - `passport-bio` — Generic ID-3 passport bio page (125×88)
 *   - `cn-driver-license` — PRC driver license (88×60)
 *   - `cn-vehicle-license` — PRC vehicle license (88×60, single sided)
 *   - `letter` / `a4` — Plain documents at standard paper sizes
 *
 * S6 will expand this with locale-specific variants (HK / TW ID,
 * Japanese my-number card, Indian Aadhaar, etc.). Until then, the
 * default is `cn-id-card` — the highest-traffic target.
 *
 * Output resolution:
 *
 *   Render at 300 DPI by default — matches the "scanner" expectation
 *   most government portals enforce (a 600 DPI scan is rejected for
 *   being too big; 200 DPI is fuzzy). Configurable via the `dpi`
 *   argument to `getOutputPixels`.
 */

export interface DocSpec {
  /** Stable id used for routes, i18n, persistence. Lower-kebab-case. */
  id: string
  /** Physical width in millimeters. */
  widthMm: number
  /** Physical height in millimeters. */
  heightMm: number
  /** Whether the document conventionally has a back side. */
  hasBack: boolean
  /** Logical grouping for the picker UI ("id-card", "passport", "paper"). */
  group: 'id-card' | 'passport' | 'driver-license' | 'vehicle-license' | 'paper'
}

export const DOC_SPECS: readonly DocSpec[] = [
  {
    id: 'cn-id-card',
    widthMm: 85.6,
    heightMm: 54,
    hasBack: true,
    group: 'id-card',
  },
  {
    id: 'passport-bio',
    widthMm: 125,
    heightMm: 88,
    hasBack: false,
    group: 'passport',
  },
  {
    id: 'cn-driver-license',
    widthMm: 88,
    heightMm: 60,
    hasBack: true,
    group: 'driver-license',
  },
  {
    id: 'cn-vehicle-license',
    widthMm: 88,
    heightMm: 60,
    hasBack: true,
    group: 'vehicle-license',
  },
  {
    id: 'a4',
    widthMm: 210,
    heightMm: 297,
    hasBack: false,
    group: 'paper',
  },
  {
    id: 'letter',
    widthMm: 215.9,
    heightMm: 279.4,
    hasBack: false,
    group: 'paper',
  },
] as const

export const DEFAULT_DOC_SPEC_ID = 'cn-id-card'

const DEFAULT_DPI = 300
const MM_PER_INCH = 25.4

/**
 * Resolve a spec by id, falling back to `cn-id-card` so callers don't
 * have to handle missing-spec edge cases (a stale localStorage value
 * shouldn't crash the UI).
 */
export function getDocSpec(id: string | null | undefined): DocSpec {
  if (!id) return DOC_SPECS[0]!
  return DOC_SPECS.find((s) => s.id === id) ?? DOC_SPECS[0]!
}

/**
 * Convert a `DocSpec`'s physical dimensions to a pixel canvas at
 * `dpi` (default 300). Returned values are integers so they're safe
 * to feed straight into `canvas.width / height`.
 */
export function getOutputPixels(
  spec: DocSpec,
  dpi: number = DEFAULT_DPI,
): {
  width: number
  height: number
} {
  return {
    width: Math.round((spec.widthMm / MM_PER_INCH) * dpi),
    height: Math.round((spec.heightMm / MM_PER_INCH) * dpi),
  }
}
