import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { routing, type Locale } from '@/i18n/routing'
import enMessages from '@/i18n/messages/en.json'
import zhHansMessages from '@/i18n/messages/zh-Hans.json'
import zhHantMessages from '@/i18n/messages/zh-Hant.json'

/**
 * Locale → message bundle map.
 *
 * We deliberately use *static* imports here instead of the dynamic
 * `await import(\`@/i18n/messages/${locale}.json\`)` pattern that
 * next-intl's quickstart suggests.
 *
 * On Cloudflare Workers (via @opennextjs/cloudflare) dynamic imports
 * resolve through a Promise / Module object that, under enough
 * concurrent SSR traffic, can be touched by a request handler that
 * didn't create it. Workers' strict per-request I/O isolation then
 * throws:
 *
 *   "Cannot perform I/O on behalf of a different request.
 *    (I/O type: RefcountedCanceler)"
 *
 * → the SSR fails → the Worker hangs → the runtime cancels the
 * request → end user sees Error 1102.
 *
 * Local `next dev` and `pnpm cf:preview` are single-tenant so the
 * race never fires; only real production traffic surfaces it.
 *
 * Static imports inline the JSON into the worker bundle at build
 * time, eliminating the runtime Promise altogether. Total cost:
 * ~105 KB across three locales, well below the 1 MiB Workers bundle
 * cap on the free plan and immaterial against the 10 MiB paid cap.
 */
const MESSAGES = {
  en: enMessages,
  'zh-Hans': zhHansMessages,
  'zh-Hant': zhHantMessages,
} as const satisfies Record<Locale, Record<string, unknown>>

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: MESSAGES[locale],
  }
})
