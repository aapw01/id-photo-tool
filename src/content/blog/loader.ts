/**
 * Lazy-loader for per-article, per-locale body content.
 *
 * Article bodies live in `src/content/blog/<slug>/<locale>.ts` so the
 * top-level registry stays small. We resolve them via a static map
 * instead of a dynamic `import()` so build-time path resolution
 * matches the static-site export behaviour (no chunk loaders, no
 * runtime fetch).
 */

import type { ArticleBody } from './index'
import { article as usVisaEn } from './us-visa-photo-2026/en'
import { article as usVisaZhHans } from './us-visa-photo-2026/zh-Hans'
import { article as usVisaZhHant } from './us-visa-photo-2026/zh-Hant'
import { article as docGuideEn } from './12-doc-scan-pdf-guide/en'
import { article as docGuideZhHans } from './12-doc-scan-pdf-guide/zh-Hans'
import { article as docGuideZhHant } from './12-doc-scan-pdf-guide/zh-Hant'

import type { Locale } from '@/i18n/routing'

// Long-form blog bodies are hand-authored — we only have zh-Hans /
// zh-Hant / en. For every other supported locale we fall back to the
// English body so the route still resolves and the SSG build does not
// crash. The locale-prefixed URL stays canonical; the visible copy is
// English until a native-speaker contributor translates the article.
type LocaleBodies = Partial<Record<Locale, ArticleBody>>

const BODIES: Record<string, LocaleBodies> = {
  'us-visa-photo-2026': {
    en: usVisaEn,
    'zh-Hans': usVisaZhHans,
    'zh-Hant': usVisaZhHant,
  },
  '12-doc-scan-pdf-guide': {
    en: docGuideEn,
    'zh-Hans': docGuideZhHans,
    'zh-Hant': docGuideZhHant,
  },
}

export function getArticleBody(slug: string, locale: Locale): ArticleBody | null {
  const bodies = BODIES[slug]
  if (!bodies) return null
  return bodies[locale] ?? bodies.en ?? null
}
