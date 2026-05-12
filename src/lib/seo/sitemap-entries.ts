/**
 * Pure builder for the Pixfit sitemap, factored out of
 * `src/app/sitemap.ts` so it can be unit-tested without dragging
 * the entire Next.js metadata route handler into the suite.
 */

import type { MetadataRoute } from 'next'

import type { Locale } from '@/i18n/routing'
import { buildAlternateLanguages, buildCanonical } from './metadata'
import { SUPPORTED_LOCALES } from './site-config'

interface RouteSpec {
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

/** Routes that should be indexed across every locale. */
export const SITEMAP_ROUTES: RouteSpec[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/studio', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/sizes', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/paper', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/templates', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/specs', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

/**
 * Build sitemap entries with hreflang alternates.
 *
 * `now` is parameterised so tests can pin the timestamp.
 */
export function buildSitemapEntries(
  now: Date = new Date(),
  routes: RouteSpec[] = SITEMAP_ROUTES,
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
