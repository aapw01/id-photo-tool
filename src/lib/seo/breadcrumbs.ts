/**
 * Shared breadcrumb data source.
 *
 * The same ordered list feeds both the visible `<Breadcrumb />`
 * component and the `BreadcrumbList` JSON-LD payload, so the labels
 * cannot drift between the two surfaces — Google flags pages whose
 * structured breadcrumbs don't match what the user sees.
 *
 * Items are stored as relative paths so the visible UI can use the
 * locale-aware `Link` from `@/i18n/navigation`; the JSON-LD
 * serialiser resolves them to absolute URLs via `buildCanonical`.
 */

import type { Locale } from '@/i18n/routing'
import { breadcrumbSchema } from './jsonld'
import { buildCanonical } from './metadata'

export interface BreadcrumbItem {
  /** Relative path for use with the locale-aware Link. */
  path: string
  /** Pre-localised display name for both the UI and the JSON-LD. */
  name: string
}

export type BreadcrumbRouteKey =
  | 'scanner'
  | 'scanner-detail'
  | 'sizes'
  | 'sizes-detail'
  | 'paper'
  | 'templates'
  | 'specs'
  | 'compress'
  | 'compress-detail'
  | 'quick-tools'
  | 'blog'
  | 'blog-detail'
  | 'privacy'
  | 'terms'

export interface BreadcrumbLabels {
  home: string
  scanner?: string
  sizes?: string
  paper?: string
  templates?: string
  specs?: string
  compress?: string
  quickTools?: string
  blog?: string
  privacy?: string
  terms?: string
}

export interface BreadcrumbDetailOptions {
  /** Display name for the final, current-page crumb. */
  itemName: string
  /** URL slug for the final crumb (e.g. `us-visa`). */
  itemSlug: string
}

interface BreadcrumbRouteOptions {
  labels: BreadcrumbLabels
  detail?: BreadcrumbDetailOptions
}

/**
 * Resolve the breadcrumb trail for a given route key. The caller
 * supplies pre-translated labels (we deliberately don't reach into
 * the next-intl context here so the helper stays pure / testable).
 *
 * Detail routes (`scanner-detail`, `sizes-detail`) additionally
 * require `detail.itemName` + `detail.itemSlug` for the final hop.
 */
export function getBreadcrumbItems(
  routeKey: BreadcrumbRouteKey,
  options: BreadcrumbRouteOptions,
): BreadcrumbItem[] {
  const { labels, detail } = options
  const home: BreadcrumbItem = { path: '/', name: labels.home }

  switch (routeKey) {
    case 'scanner':
      return [home, { path: '/scanner', name: labels.scanner ?? 'Scanner' }]
    case 'scanner-detail': {
      if (!detail) throw new Error('scanner-detail requires `detail` options')
      return [
        home,
        { path: '/scanner', name: labels.scanner ?? 'Scanner' },
        { path: `/scanner/${detail.itemSlug}`, name: detail.itemName },
      ]
    }
    case 'sizes':
      return [home, { path: '/sizes', name: labels.sizes ?? 'Sizes' }]
    case 'sizes-detail': {
      if (!detail) throw new Error('sizes-detail requires `detail` options')
      return [
        home,
        { path: '/sizes', name: labels.sizes ?? 'Sizes' },
        { path: `/sizes/${detail.itemSlug}`, name: detail.itemName },
      ]
    }
    case 'paper':
      return [home, { path: '/paper', name: labels.paper ?? 'Paper' }]
    case 'templates':
      return [home, { path: '/templates', name: labels.templates ?? 'Templates' }]
    case 'specs':
      return [home, { path: '/specs', name: labels.specs ?? 'Specs' }]
    case 'compress':
      return [home, { path: '/compress', name: labels.compress ?? 'Compress' }]
    case 'quick-tools':
      return [home, { path: '/quick-tools', name: labels.quickTools ?? 'Quick tools' }]
    case 'compress-detail': {
      if (!detail) throw new Error('compress-detail requires `detail` options')
      return [
        home,
        { path: '/compress', name: labels.compress ?? 'Compress' },
        { path: `/compress/${detail.itemSlug}`, name: detail.itemName },
      ]
    }
    case 'blog':
      return [home, { path: '/blog', name: labels.blog ?? 'Blog' }]
    case 'blog-detail': {
      if (!detail) throw new Error('blog-detail requires `detail` options')
      return [
        home,
        { path: '/blog', name: labels.blog ?? 'Blog' },
        { path: `/blog/${detail.itemSlug}`, name: detail.itemName },
      ]
    }
    case 'privacy':
      return [home, { path: '/privacy', name: labels.privacy ?? 'Privacy' }]
    case 'terms':
      return [home, { path: '/terms', name: labels.terms ?? 'Terms' }]
  }
}

/**
 * Convert a `BreadcrumbItem[]` into the schema.org `BreadcrumbList`
 * payload. Centralised here so the visible UI and the JSON-LD
 * blob can never diverge — they both walk the same array.
 */
export function breadcrumbItemsToJsonLd(items: BreadcrumbItem[], locale: Locale) {
  return breadcrumbSchema(
    items.map((item) => ({ url: buildCanonical(item.path, locale), name: item.name })),
  )
}
