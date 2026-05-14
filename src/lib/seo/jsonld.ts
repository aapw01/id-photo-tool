/**
 * Helpers for building schema.org JSON-LD payloads.
 *
 * We keep these as pure data builders (no React) so the same shapes
 * can be unit-tested and re-serialised. The `<JsonLd />` component
 * (see `components/jsonld.tsx`) handles DOM injection + escaping.
 */

import type { Locale } from '@/i18n/routing'
import { buildCanonical } from './metadata'
import { SITE_NAME, SITE_NAME_FULL, SITE_URL } from './site-config'

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[]
export interface JsonLdObject {
  '@context'?: string
  '@type'?: string | string[]
  [key: string]: JsonLdValue | undefined
}

interface WebApplicationOpts {
  /**
   * Optional keyword cluster mirrored from the page's
   * `<meta name="keywords">` so Google's rich-result crawler sees the
   * same intent in both surfaces. Helps long-tail discovery for
   * queries like "AI 证件照" / "intelligent ID photo" without having
   * to repeat the words in the page body.
   */
  keywords?: readonly string[]
}

/** Default Pixfit WebApplication schema (injected into the home layout). */
export function webApplicationSchema(locale: Locale, opts: WebApplicationOpts = {}): JsonLdObject {
  const out: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME_FULL,
    alternateName: SITE_NAME,
    url: buildCanonical('/', locale),
    applicationCategory: 'PhotographyApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    isAccessibleForFree: true,
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }
  if (opts.keywords && opts.keywords.length > 0) {
    out.keywords = opts.keywords.join(', ')
  }
  return out
}

interface WebSiteOpts {
  /**
   * Canonical home URL for the active locale. Falls back to the
   * locale-prefixed `/` so callers don't have to recompute it.
   */
  url?: string
  /** Optional keyword cluster — same shape as `webApplicationSchema`. */
  keywords?: readonly string[]
}

/**
 * schema.org `WebSite` — pairs nicely with `WebApplication` on the
 * home page. Google uses this to populate the sitelinks search box
 * and to attribute brand searches ("Pixfit", "pix-fit.com") to the
 * canonical URL.
 *
 * The optional `potentialAction` would normally wire a search URL,
 * but Pixfit has no on-site search so we deliberately omit it — an
 * empty SearchAction can suppress the rich result entirely.
 */
export function webSiteSchema(locale: Locale, opts: WebSiteOpts = {}): JsonLdObject {
  const url = opts.url ?? buildCanonical('/', locale)
  const out: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME_FULL,
    alternateName: SITE_NAME,
    url,
    inLanguage: locale,
  }
  if (opts.keywords && opts.keywords.length > 0) {
    out.keywords = opts.keywords.join(', ')
  }
  return out
}

interface ItemListEntry {
  /** Absolute URL the listing points at. */
  url: string
  /** Display name shown in the rich snippet. */
  name: string
  /** Optional human-readable description. */
  description?: string
}

interface ItemListOpts {
  url: string
  name: string
  description?: string
  items: ItemListEntry[]
}

/** schema.org `ItemList` used by the /sizes /paper /templates list pages. */
export function itemListSchema(opts: ItemListOpts): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: item.url,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  }
}

/** Breadcrumbs (Home › Section › Page) for inner pages. */
export function breadcrumbSchema(crumbs: Array<{ url: string; name: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: c.name,
      item: c.url,
    })),
  }
}

interface FaqEntry {
  /** Question text — used verbatim in the rich snippet. */
  question: string
  /** Plain-text answer; we deliberately don't render HTML here. */
  answer: string
}

/**
 * schema.org `FAQPage`. Eligible for Google's FAQ rich result when the
 * questions are user-meaningful (not marketing fluff) and the answers
 * are visible on the same page.
 */
export function faqSchema(entries: FaqEntry[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: e.answer,
      },
    })),
  }
}

interface HowToStep {
  /** Imperative step title, e.g. "Upload a portrait". */
  name: string
  /** One- or two-sentence description of what happens in this step. */
  text: string
}

interface HowToOpts {
  /** Localised goal — e.g. "Make a US visa photo online". */
  name: string
  /** Short single-sentence description of the goal. */
  description: string
  steps: HowToStep[]
  /** Estimated total duration in ISO 8601 (e.g. "PT2M"). */
  totalTimeISO?: string
}

/**
 * schema.org `HowTo` for spec detail pages — Google still surfaces
 * this in some "how to" voice/search contexts even after the rich
 * result deprecation, and it doesn't hurt as semantic markup.
 */
export function howToSchema(opts: HowToOpts): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    ...(opts.totalTimeISO ? { totalTime: opts.totalTimeISO } : {}),
    step: opts.steps.map((step, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: step.name,
      text: step.text,
    })),
  }
}

/**
 * Serialise a JSON-LD payload while escaping `</` and `<!--` so the
 * resulting `<script>` tag can never be terminated early by user data.
 */
export function serializeJsonLd(value: JsonLdObject): string {
  return JSON.stringify(value).replace(/</g, '\\u003C').replace(/-->/g, '--\\u003E')
}

/** Helper used by tests to keep the SITE_URL constant in one place. */
export function getSiteUrl(): string {
  return SITE_URL
}
