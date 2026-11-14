/**
 * Pure builder for the Pixfit sitemap, factored out of
 * `src/app/sitemap.ts` so it can be unit-tested without dragging
 * the entire Next.js metadata route handler into the suite.
 *
 * Priority tiers — agreed with PRD §SEO:
 *   1.0 ........ home
 *   0.9 ........ primary tools (studio, scanner)
 *   0.8 ........ long-tail tool detail pages (sizes/[id], scanner/[id])
 *   0.7 ........ landing hubs (sizes, paper, templates, specs)
 *   0.5 ........ legal (privacy, terms)
 *
 * changeFrequency:
 *   - `weekly` for active tool pages (home + tool surfaces + tool
 *     detail landing pages — they pick up copy / catalog tweaks fast)
 *   - `monthly` for landing-hub indexes
 *   - `yearly` for legal pages
 *
 * `lastModified` is sourced from `SEO_LASTMOD` below — a single
 * hand-bumped constant per content tranche. We chose this over a
 * git-mtime probe (the only other simple option) because:
 *   - `next sitemap` runs in the prebuild and we don't want it to
 *     shell out to `git` (build environments may not have a full
 *     git history, especially on shallow CI clones).
 *   - Bumping the constant when a meaningful copy / data change
 *     ships is an explicit, reviewable signal to crawlers.
 * Update `SEO_LASTMOD` whenever you ship new copy / new specs /
 * new doc types — daily noise (e.g. README tweaks) doesn't need it.
 */

import type { MetadataRoute } from 'next'

import { BLOG_POSTS } from '@/content/blog'
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { COMPRESS_TARGETS } from '@/features/compress/targets'
import { DOC_SPECS as SCANNER_DOC_SPECS } from '@/features/scanner/lib/doc-specs'
import type { Locale } from '@/i18n/routing'
import { buildAlternateLanguages, buildCanonical } from './metadata'
import { SUPPORTED_LOCALES } from './site-config'

interface RouteSpec {
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

/**
 * Per-content-tranche last-modified anchor. Bump when shipping
 * meaningful copy / data changes (new specs, new doc types,
 * rewritten landing-page intros). Daily noise doesn't need a bump.
 */
export const SEO_LASTMOD = new Date('2026-11-14T00:00:00Z')

/**
 * Static routes that should be indexed across every locale.
 *
 * Per-spec detail pages (`/sizes/[specId]`) and scanner DocType
 * pages (`/scanner/[docType]`) are emitted separately by
 * `specDetailRoutes` / `scannerDocTypeRoutes` so we don't have to
 * mirror the catalog lists inside this constant.
 */
export const SITEMAP_ROUTES: RouteSpec[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/studio', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/scanner', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/sizes', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/paper', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/templates', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/specs', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/compress', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.5 },
]

/**
 * Long-tail spec detail routes. One per built-in PhotoSpec — these
 * are the pages we want ranking for queries like "US visa photo
 * size" or "美国签证照片尺寸", so they sit at the high-priority
 * 0.8 tier (above the landing-hub indexes) and refresh weekly to
 * pick up new copy / spec edits.
 */
export function specDetailRoutes(): RouteSpec[] {
  return BUILTIN_PHOTO_SPECS.map((spec) => ({
    path: `/sizes/${spec.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
}

/**
 * Scanner sub-product DocType landing pages. One per built-in
 * Scanner DocSpec (`cn-id-card`, `hk-id-card`, `passport-bio`, …).
 * Same priority tier as `/sizes/[specId]` since both surfaces are
 * long-tail tool landing pages; they target queries like
 * "中国身份证扫描 在线" / "US driver license scan PDF".
 */
export function scannerDocTypeRoutes(): RouteSpec[] {
  return SCANNER_DOC_SPECS.map((spec) => ({
    path: `/scanner/${spec.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
}

/**
 * Per-target compression landing pages, one per
 * `COMPRESS_TARGETS` entry (50kb / 100kb / 200kb / 500kb / 1mb).
 * Same priority tier as the other tool detail pages — they target
 * a high-intent long-tail cluster ("compress photo to 50kb").
 */
export function compressTargetRoutes(): RouteSpec[] {
  return COMPRESS_TARGETS.map((target) => ({
    path: `/compress/${target.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
}

/**
 * Per-article blog posts. Articles are evergreen but get occasional
 * copy refreshes, so they sit in the same priority tier as the
 * landing hubs (0.7) and refresh monthly.
 */
export function blogPostRoutes(): RouteSpec[] {
  return BLOG_POSTS.map((post) => ({
    path: `/blog/${post.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
}

/**
 * Build sitemap entries with hreflang alternates.
 *
 * `now` defaults to `SEO_LASTMOD` — pass an explicit Date in tests
 * to pin the timestamp.
 */
export function buildSitemapEntries(
  now: Date = SEO_LASTMOD,
  routes: RouteSpec[] = [
    ...SITEMAP_ROUTES,
    ...specDetailRoutes(),
    ...scannerDocTypeRoutes(),
    ...compressTargetRoutes(),
    ...blogPostRoutes(),
  ],
  locales: readonly Locale[] = SUPPORTED_LOCALES,
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []
  for (const route of routes) {
    const languages = buildAlternateLanguages(route.path)
    for (const locale of locales) {
      entries.push({
        url: buildCanonical(route.path, locale),
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages },
      })
    }
  }
  return entries
}
