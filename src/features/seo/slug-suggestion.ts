/**
 * Pure slug-suggestion helper used by the 404 page's "did you mean?"
 * hint.
 *
 * When a user lands on `/zh-Hans/sizes/us-vsa` (typo for `us-visa`),
 * we want to surface a nudge towards the real spec landing page
 * rather than leaving them stuck on a generic 404. The helper does
 * three things:
 *
 *   1. Strip the locale + a `/sizes/` or `/scanner/` prefix out of
 *      the path to get a candidate slug.
 *   2. Score every catalog id against the candidate via a tiny
 *      Damerau-Levenshtein-lite distance.
 *   3. Return the best match if it's "close enough" (a Levenshtein
 *      ratio ≤ 0.4), tagged with the surface it belongs to.
 *
 * Pure, dependency-free, deterministic — easy to unit-test.
 */

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { DOC_SPECS as SCANNER_DOC_SPECS } from '@/features/scanner/lib/doc-specs'

/** A suggested route surfaced under the 404 "did you mean?" hint. */
export interface SlugSuggestion {
  /** Catalog surface — drives `href` shape + i18n label namespace. */
  kind: 'spec' | 'scannerDoc'
  /** Canonical catalog id (e.g. `us-visa`, `cn-id-card`). */
  id: string
  /** Locale-relative path the visible CTA should link to. */
  path: string
}

/**
 * Threshold for the ratio of edit-distance to candidate length. A
 * value of 0.4 means a 10-char candidate can have up to 4 typos —
 * tight enough to avoid noise on completely-unrelated paths but
 * loose enough to catch real fat-fingered slugs like `usvisa`,
 * `us-vsa`, `cnid-card`.
 */
const SUGGESTION_MAX_RATIO = 0.4

/**
 * Locale-prefixed path → bare candidate slug (the bit after
 * `/sizes/` or `/scanner/`). Returns `null` if the path doesn't
 * look like a detail-page URL (no need to suggest anything).
 *
 * Accepted shapes (all three locales):
 *   - `/{locale}/sizes/{slug}`
 *   - `/{locale}/scanner/{slug}`
 *   - `/sizes/{slug}` (no locale segment — defensive)
 *   - `/scanner/{slug}`
 */
export function extractCandidateSlug(
  path: string,
): { kind: 'spec' | 'scannerDoc'; slug: string } | null {
  const cleaned = path.replace(/\?.*$/, '').replace(/#.*$/, '')
  const segments = cleaned.split('/').filter(Boolean)
  if (segments.length === 0) return null
  // Drop a leading locale segment if present. We don't import the
  // routing config here to keep this helper testable without
  // dragging the i18n graph in.
  const LOCALE_PATTERN = /^(en|zh-Hans|zh-Hant)$/i
  const withoutLocale = LOCALE_PATTERN.test(segments[0] ?? '') ? segments.slice(1) : segments
  if (withoutLocale.length < 2) return null
  const [head, slug] = withoutLocale
  if (head === 'sizes') return { kind: 'spec', slug: slug! }
  if (head === 'scanner') return { kind: 'scannerDoc', slug: slug! }
  return null
}

/**
 * Optimal-string-alignment (a.k.a. restricted Damerau-Levenshtein)
 * distance. Handles single-character transpositions in addition to
 * the standard insert / delete / substitute. Good enough for
 * fat-fingered slug matching without pulling in a fuzzy-search lib.
 */
function osaDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const rows = a.length + 1
  const cols = b.length + 1
  // 2-row rolling buffer is enough for OSA — we never look back further
  // than one row + one column for the transposition rule. Keep three
  // rows so the transposition step (i-2, j-2) can index them.
  const prev2: number[] = new Array(cols).fill(0)
  let prev: number[] = new Array(cols)
  let curr: number[] = new Array(cols)
  for (let j = 0; j < cols; j++) prev[j] = j
  for (let i = 1; i < rows; i++) {
    curr[0] = i
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j]!, prev2[j - 2]! + 1)
      }
    }
    // Slide the rolling window: prev2 ← prev, prev ← curr, curr ← prev2.
    const tmp = prev2.slice()
    for (let k = 0; k < cols; k++) prev2[k] = prev[k]!
    prev = curr
    curr = tmp
  }
  return prev[cols - 1]!
}

/**
 * Suggest the catalog slug closest to the path's candidate, or
 * `null` if nothing is close enough. Deterministic — ties break on
 * the catalog's canonical (insertion) order.
 */
export function suggestSlug(path: string): SlugSuggestion | null {
  const candidate = extractCandidateSlug(path)
  if (!candidate) return null
  const pool =
    candidate.kind === 'spec'
      ? BUILTIN_PHOTO_SPECS.map((s) => s.id)
      : SCANNER_DOC_SPECS.map((s) => s.id)
  if (pool.includes(candidate.slug)) {
    // Exact match — page exists but maybe got 404 due to a casing
    // issue elsewhere. Return it anyway so the hint nudges the user
    // back into the canonical slug.
    return {
      kind: candidate.kind,
      id: candidate.slug,
      path: `/${candidate.kind === 'spec' ? 'sizes' : 'scanner'}/${candidate.slug}`,
    }
  }
  let bestId: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const id of pool) {
    const d = osaDistance(candidate.slug.toLowerCase(), id.toLowerCase())
    if (d < bestDistance) {
      bestDistance = d
      bestId = id
    }
  }
  if (!bestId) return null
  const ratio = bestDistance / Math.max(candidate.slug.length, bestId.length)
  if (ratio > SUGGESTION_MAX_RATIO) return null
  return {
    kind: candidate.kind,
    id: bestId,
    path: `/${candidate.kind === 'spec' ? 'sizes' : 'scanner'}/${bestId}`,
  }
}
