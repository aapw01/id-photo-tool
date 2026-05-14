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

export type DocSpecGroup = 'id-card' | 'passport' | 'driver-license' | 'vehicle-license' | 'paper'

/**
 * Canonical render order for the picker UI — `id-card` is the most
 * common scan target so it leads, followed by license / passport,
 * with full-page paper at the end (least common, larger output).
 */
export const DOC_SPEC_GROUP_ORDER: readonly DocSpecGroup[] = [
  'id-card',
  'driver-license',
  'vehicle-license',
  'passport',
  'paper',
] as const

export interface DocSpec {
  /** Stable id used for routes, i18n, persistence. Lower-kebab-case. */
  id: string
  /** Physical width in millimeters. */
  widthMm: number
  /** Physical height in millimeters. */
  heightMm: number
  /** Whether the document conventionally has a back side. */
  hasBack: boolean
  /** Logical grouping for the picker UI. */
  group: DocSpecGroup
}

export const DOC_SPECS: readonly DocSpec[] = [
  // ISO/IEC 7810 ID-1 family (CR80, 85.6 × 54)
  { id: 'cn-id-card', widthMm: 85.6, heightMm: 54, hasBack: true, group: 'id-card' },
  { id: 'hk-id-card', widthMm: 85.6, heightMm: 54, hasBack: true, group: 'id-card' },
  { id: 'tw-id-card', widthMm: 85.6, heightMm: 54, hasBack: true, group: 'id-card' },
  { id: 'sg-nric', widthMm: 85.6, heightMm: 54, hasBack: true, group: 'id-card' },
  { id: 'in-aadhaar', widthMm: 85.6, heightMm: 54, hasBack: true, group: 'id-card' },
  { id: 'us-driver-license', widthMm: 85.6, heightMm: 54, hasBack: true, group: 'driver-license' },

  // Passport bio pages — ISO/IEC 7810 ID-3 (125 × 88), single-sided
  { id: 'passport-bio', widthMm: 125, heightMm: 88, hasBack: false, group: 'passport' },

  // PRC car documents — booklet pages, slightly larger than CR80
  { id: 'cn-driver-license', widthMm: 88, heightMm: 60, hasBack: true, group: 'driver-license' },
  {
    id: 'cn-vehicle-license',
    widthMm: 88,
    heightMm: 60,
    hasBack: true,
    group: 'vehicle-license',
  },

  // Plain paper at full size (use case: receipts, single-page contracts)
  { id: 'a4', widthMm: 210, heightMm: 297, hasBack: false, group: 'paper' },
  { id: 'letter', widthMm: 215.9, heightMm: 279.4, hasBack: false, group: 'paper' },
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
 * Group the catalog into the canonical render order used by the
 * picker UI. Groups with no entries are dropped so the consumer
 * doesn't render empty `<optgroup>` headers. Exported so the
 * groupings can be exercised in unit tests without touching React.
 */
export function groupDocSpecs(
  specs: readonly DocSpec[] = DOC_SPECS,
): Array<{ group: DocSpecGroup; specs: DocSpec[] }> {
  const out: Array<{ group: DocSpecGroup; specs: DocSpec[] }> = []
  for (const group of DOC_SPEC_GROUP_ORDER) {
    const matched = specs.filter((s) => s.group === group)
    if (matched.length > 0) out.push({ group, specs: [...matched] })
  }
  return out
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
