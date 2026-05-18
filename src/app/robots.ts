import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/seo/site-config'

/**
 * Generative AI crawlers we explicitly opt into. As of 2026 these
 * are the bots that feed major AI search / answer surfaces — being
 * in their crawl set is how Pixfit shows up inside Copilot, ChatGPT
 * search, Perplexity, Claude, Apple Intelligence, etc. We list each
 * one as its own rule (instead of relying on the wildcard) so that
 * (a) the intent is visible to anyone reading robots.txt, and (b)
 * a future tightening of the wildcard (e.g. disallowing scrapers)
 * cannot accidentally lock out these specific bots.
 */
const AI_CRAWLER_AGENTS = [
  'GPTBot',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
  'Amazonbot',
] as const

/** Host header value (no scheme / no trailing slash) for `Host:` directive. */
function hostOnly(siteUrl: string): string {
  try {
    return new URL(siteUrl).host
  } catch {
    return siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  }
}

export default function robots(): MetadataRoute.Robots {
  const aiCrawlerRules: MetadataRoute.Robots['rules'] = AI_CRAWLER_AGENTS.map((agent) => ({
    userAgent: agent,
    allow: '/',
  }))

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Dev pages live under `/[locale]/dev/...`, so the leading wildcard
        // is necessary; the bare `/dev/` form keeps things explicit for the
        // (currently unused) root-level case.
        disallow: ['/dev/', '*/dev/*', '/api/'],
      },
      ...aiCrawlerRules,
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: hostOnly(SITE_URL),
  }
}

export { AI_CRAWLER_AGENTS }
