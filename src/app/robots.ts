import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/seo/site-config'

export default function robots(): MetadataRoute.Robots {
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
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
