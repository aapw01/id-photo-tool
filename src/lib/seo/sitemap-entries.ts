/**
 * Pure builder for the Pixfit sitemap, factored out of
 * `src/app/sitemap.ts` so it can be unit-tested without dragging
 * the entire Next.js metadata route handler into the suite.
 */

import type { MetadataRoute } from 'next'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import type { Locale } from '@/i18n/routing'
import { buildAlternateLanguages, buildCanonical } from './metadata'
import { SUPPORTED_LOCALES } from './site-config'

interface RouteSpec {
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

/**
 * Static routes that should be indexed across every locale.
 *
 * `/specs` is intentionally absent: the tool is no-login and uses an
 * inline custom-size form in the studio, so the spec manager is a
 * power-user side path we'd rather not promote via sitemap.
 *
 * Per-spec detail pages (`/sizes/[specId]`) are emitted separately —
 * see `buildSitemapEntries` — so we don't have to mirror the
 * `BUILTIN_PHOTO_SPECS` list inside this constant.
 */
export const SITEMAP_ROUTES: RouteSpec[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/studio', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/scanner', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/sizes', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/paper', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/templates', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

/**
 * Long-tail spec detail routes. One per built-in PhotoSpec — these are
 * the pages we want ranking for queries like "US visa photo size" or
 * "美国签证照片尺寸", so they ship with a slightly higher priority
 * than the rest of the catalog and indicate weekly refresh cadence so
 * crawlers come back after copy changes.
 */
export function specDetailRoutes(): RouteSpec[] {
  return BUILTIN_PHOTO_SPECS.map((spec) => ({
    path: `/sizes/${spec.id}`,
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  }))
}

/**
 * Build sitemap entries with hreflang alternates.
 *
 * `now` is parameterised so tests can pin the timestamp.
 */
export function buildSitemapEntries(
  now: Date = new Date(),
  routes: RouteSpec[] = [...SITEMAP_ROUTES, ...specDetailRoutes()],
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
