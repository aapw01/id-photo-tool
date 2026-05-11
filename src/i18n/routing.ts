import { defineRouting } from 'next-intl/routing'

export type Locale = 'zh-Hans' | 'zh-Hant' | 'en'

export const routing = defineRouting({
  locales: ['zh-Hans', 'zh-Hant', 'en'] as const,
  defaultLocale: 'zh-Hans',
  localePrefix: 'always',
  localeDetection: true,
})
