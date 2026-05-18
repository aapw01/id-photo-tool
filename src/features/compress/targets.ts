/**
 * Compression target catalog used by `/compress` + `/compress/[target]`
 * landing pages and by the footer / sitemap wiring.
 *
 * Each target has:
 *   - `slug`     URL segment (lower-case, no dashes)
 *   - `label`    Display value used in titles / headings ("50KB",
 *                "100KB", … "1MB"). Kept upper-case for the visual
 *                weight on poster-style hero copy.
 *   - `kb`       Numeric KB anchor — drives the deep-link query
 *                (`?compress=50kb`) and downstream studio preset.
 *
 * The list is intentionally short and ordered from "tightest" to
 * "loosest" so the index page reads as a progression from the
 * strictest visa-portal budget (50 KB) up to the most generous
 * general-purpose target (1 MB).
 */

export interface CompressTarget {
  /** URL slug — must be the path segment used in `/compress/[target]`. */
  slug: string
  /** Display label — what the hero / button text renders. */
  label: string
  /** Numeric KB equivalent (1 MB == 1024 KB). */
  kb: number
}

export const COMPRESS_TARGETS: readonly CompressTarget[] = [
  { slug: '50kb', label: '50KB', kb: 50 },
  { slug: '100kb', label: '100KB', kb: 100 },
  { slug: '200kb', label: '200KB', kb: 200 },
  { slug: '500kb', label: '500KB', kb: 500 },
  { slug: '1mb', label: '1MB', kb: 1024 },
] as const

/** Look up a target by its URL slug, returning `null` for misses. */
export function findCompressTarget(slug: string): CompressTarget | null {
  return COMPRESS_TARGETS.find((t) => t.slug === slug) ?? null
}
