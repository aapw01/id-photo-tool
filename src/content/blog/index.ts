/**
 * Blog post registry. Everything about `/blog` flows from this module:
 *
 *   - The two articles in the launch bundle are listed in `BLOG_POSTS`
 *     with their canonical metadata (slug, publication dates, hero
 *     tagline keys).
 *   - Per-locale article *bodies* live in
 *     `src/content/blog/<slug>/<locale>.ts` to keep the JSON message
 *     bundles small (a 1500-word article inside the i18n bundle would
 *     bloat every page payload).
 *
 * Order: newest-first by `datePublished`, so the index page can call
 * `BLOG_POSTS` directly without re-sorting.
 */

import type { Locale } from '@/i18n/routing'

export interface BlogPostMeta {
  /** URL slug — also used as the i18n key under `Blog.posts.<slug>`. */
  slug: string
  /** ISO-8601 (YYYY-MM-DD) first publication date. */
  datePublished: string
  /**
   * ISO-8601 last meaningful edit. Falls back to `datePublished` in
   * `blogPostingSchema` if omitted.
   */
  dateModified?: string
  /**
   * Reading-time estimate in minutes — surfaced on the card and the
   * article header. Hand-curated rather than auto-derived because
   * Chinese characters and English words have very different read
   * speeds.
   */
  readingMinutes: number
  /**
   * Optional bag of keyword tags pushed into the `BlogPosting`
   * JSON-LD's `keywords` field. Kept separate from the page
   * `metaKeywords` so we can tag *content* (`visa-photo`, `2x2`,
   * `2026`) independently of SERP keywords.
   */
  tags?: readonly string[]
}

/**
 * Canonical article list. Newest first. Add entries here AND drop a
 * matching `<slug>/<locale>.ts` content module under
 * `src/content/blog/`.
 */
export const BLOG_POSTS: readonly BlogPostMeta[] = [
  {
    slug: 'us-visa-photo-2026',
    datePublished: '2026-05-17',
    readingMinutes: 8,
    tags: ['us-visa', '2x2-inch', '51x51mm', 'in-browser', '2026'],
  },
  {
    slug: '12-doc-scan-pdf-guide',
    datePublished: '2026-05-17',
    readingMinutes: 7,
    tags: ['scan-to-pdf', 'document-scanner', 'in-browser', '2026'],
  },
] as const

export type BlogSlug = (typeof BLOG_POSTS)[number]['slug']

export function getBlogPost(slug: string): BlogPostMeta | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null
}

/**
 * Long-form article body. Each article ships a structured array of
 * sections: every section has a heading, an optional intro paragraph,
 * and an array of paragraph strings. Lists are expressed as their
 * own section (`type: 'list'`) so we can render `<ul>` semantically
 * without smuggling markdown back through the renderer.
 *
 * Renderer code lives in `src/app/[locale]/blog/[slug]/page.tsx`.
 */
export interface ArticleParagraph {
  type: 'p'
  text: string
}

export interface ArticleList {
  type: 'list'
  ordered?: boolean
  items: string[]
}

export interface ArticleSection {
  /** H2 heading. */
  heading: string
  /** Optional intro paragraph between the H2 and the blocks. */
  intro?: string
  blocks: Array<ArticleParagraph | ArticleList>
}

export interface ArticleBody {
  /** H1 / SERP headline. */
  title: string
  /** One-sentence dek shown under the H1 + used as meta-description. */
  description: string
  /** Sections rendered in order under the H1. */
  sections: ArticleSection[]
  /** Optional closing call-to-action paragraph. */
  closing?: string
}

export type ArticleBodyByLocale = Record<Locale, ArticleBody>
