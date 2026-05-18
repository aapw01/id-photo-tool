'use client'

import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { localizeText } from '@/lib/i18n-text'
import type { I18nText } from '@/types/spec'
import { suggestSlug } from './slug-suggestion'

interface NotFoundSuggestionProps {
  locale: Locale
  /** Pre-fetched lookup for spec id → localised name. */
  specNames: Record<string, I18nText | string>
  /** Pre-fetched lookup for doc id → localised name. */
  docNames: Record<string, string>
}

/**
 * "Did you mean?" hint rendered on the 404 page when the requested
 * path looks like a typoed spec / doc slug. Reading the pathname
 * requires `usePathname` which is client-only, hence the `'use
 * client'` boundary — everything else on the 404 page is still SSR.
 */
export function NotFoundSuggestion({ locale, specNames, docNames }: NotFoundSuggestionProps) {
  const pathname = usePathname()
  const t = useTranslations('Errors.notFound')
  const suggestion = suggestSlug(pathname ?? '')
  if (!suggestion) return null
  const rawName = suggestion.kind === 'spec' ? specNames[suggestion.id] : docNames[suggestion.id]
  const name =
    typeof rawName === 'string' || rawName == null
      ? (rawName ?? suggestion.id)
      : localizeText(rawName as I18nText, locale)
  return (
    <aside
      className="mt-6 flex flex-col items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/40 p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label={t('didYouMean', { name })}
    >
      <p className="text-sm text-[var(--color-primary-dk)]">{t('didYouMean', { name })}</p>
      <Link
        href={{ pathname: suggestion.path }}
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-dk)] hover:text-[var(--color-primary)]"
      >
        {t('didYouMeanCta', { name })}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </aside>
  )
}
