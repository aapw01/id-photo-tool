/**
 * Pure helpers for picking "you may also need" rows on the detail
 * pages.
 *
 * Goals:
 *   - Deterministic ordering so the same input always produces the
 *     same set of links (important for SSG output stability — Google
 *     punishes pages whose internal links shuffle between crawls).
 *   - Tier-aware: pick first by the strongest semantic relationship
 *     we can model from the data file alone (same country/region or
 *     same physical size bucket for photo specs; same DocSpec group
 *     for scanner doc-types), then fill the row from the next tier.
 *   - No side-effects, no async, no React — safe to import from a
 *     server component without a Client Boundary.
 */

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { DOC_SPECS, type DocSpec } from '@/features/scanner/lib/doc-specs'
import type { PhotoSpec } from '@/types/spec'

const DEFAULT_LIMIT = 6
const MIN_LIMIT = 4

/**
 * Coarse "physical size bucket" used as the secondary similarity
 * dimension when two specs don't share a region. Buckets are
 * intentionally coarse — the goal is to cluster "1-inch family"
 * together, not to draw a fine-grained taxonomy. The threshold is a
 * tolerance in mm on each axis: two specs land in the same bucket if
 * width and height match within ±2 mm (covers minor rounding between
 * the 25/26 mm 1-inch variants).
 */
const BUCKET_TOLERANCE_MM = 2

function inSameBucket(a: PhotoSpec, b: PhotoSpec): boolean {
  return (
    Math.abs(a.width_mm - b.width_mm) <= BUCKET_TOLERANCE_MM &&
    Math.abs(a.height_mm - b.height_mm) <= BUCKET_TOLERANCE_MM
  )
}

/**
 * Pick 4–6 related photo specs for the `/sizes/[specId]` detail page.
 *
 * Tier 1: specs sharing the same `region`.
 * Tier 2: specs in the same physical size bucket (1-inch family, etc.).
 * Tier 3: the canonical builtin order, used to top-up to `limit`.
 *
 * The active spec itself is always excluded; ordering within each
 * tier is the canonical `BUILTIN_PHOTO_SPECS` order so the output is
 * fully deterministic.
 *
 * Returns at least `MIN_LIMIT` entries when the catalog is large
 * enough; never returns more than `limit`.
 */
export function getRelatedSpecs(specId: string, limit: number = DEFAULT_LIMIT): PhotoSpec[] {
  const target = BUILTIN_PHOTO_SPECS.find((s) => s.id === specId)
  if (!target) return []
  const pool = BUILTIN_PHOTO_SPECS.filter((s) => s.id !== specId)
  const out: PhotoSpec[] = []
  const seen = new Set<string>()
  const push = (spec: PhotoSpec): void => {
    if (out.length >= limit || seen.has(spec.id)) return
    seen.add(spec.id)
    out.push(spec)
  }
  if (target.region) {
    for (const candidate of pool) {
      if (candidate.region === target.region) push(candidate)
    }
  }
  for (const candidate of pool) {
    if (inSameBucket(target, candidate)) push(candidate)
  }
  for (const candidate of pool) {
    push(candidate)
  }
  // Guard against a degenerate input — caller can rely on receiving
  // either an empty slice (unknown spec) or >= MIN_LIMIT entries.
  if (out.length < MIN_LIMIT && pool.length >= MIN_LIMIT) {
    for (const candidate of pool) {
      push(candidate)
      if (out.length >= MIN_LIMIT) break
    }
  }
  return out
}

/**
 * Pick 4–6 related DocSpecs for the `/scanner/[docType]` detail page.
 *
 * Tier 1: doc-types in the same `group` as the target
 *         (id-card / driver-license / vehicle-license / passport /
 *         paper).
 * Tier 2: doc-types from other groups in canonical order.
 *
 * Ordering within each tier is `DOC_SPECS` order so the output is
 * deterministic — same input always produces the same ordered list.
 */
export function getRelatedDocSpecs(docId: string, limit: number = DEFAULT_LIMIT): DocSpec[] {
  const target = DOC_SPECS.find((s) => s.id === docId)
  if (!target) return []
  const pool = DOC_SPECS.filter((s) => s.id !== docId)
  const out: DocSpec[] = []
  const seen = new Set<string>()
  const push = (spec: DocSpec): void => {
    if (out.length >= limit || seen.has(spec.id)) return
    seen.add(spec.id)
    out.push(spec)
  }
  for (const candidate of pool) {
    if (candidate.group === target.group) push(candidate)
  }
  for (const candidate of pool) {
    push(candidate)
  }
  if (out.length < MIN_LIMIT && pool.length >= MIN_LIMIT) {
    for (const candidate of pool) {
      push(candidate)
      if (out.length >= MIN_LIMIT) break
    }
  }
  return out
}
