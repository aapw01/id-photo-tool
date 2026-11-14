import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { DOC_SPECS as SCANNER_DOC_SPECS } from '@/features/scanner/lib/doc-specs'
import { NotFoundSuggestion } from '@/features/seo/not-found-suggestion'
import type { I18nText } from '@/types/spec'

/**
 * 404 metadata.
 *
 * `robots: { index: false, follow: true }` is non-negotiable — 404
 * pages must NOT enter the search index (Google would compete the
 * thin error page against the real route), but we still want crawlers
 * to follow the helpful internal links below so they can re-discover
 * the canonical surfaces.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Errors.notFound')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: false, follow: true },
  }
}

/**
 * Localised 404 page. Triggered when a deeply-nested route under
 * `/[locale]/...` matches the locale segment but no route after it.
 *
 * In addition to the brand-aligned visual treatment, the page now
 * ships:
 *
 *   1. `metadata.robots` with `index: false, follow: true`
 *   2. A 5-link "Try one of these instead" block — Home / Studio /
 *      Scanner / All sizes / All document types — so users (and
 *      crawlers) can hop back into the canonical surfaces.
 *   3. A client-side `<NotFoundSuggestion />` that reads the
 *      pathname and surfaces a "did you mean ${slug}?" hint when
 *      the URL looks like a typoed spec / doc slug.
 */
export default async function LocaleNotFound() {
  // `not-found.tsx` doesn't receive params; pull the locale from
  // next-intl's request context. `setRequestLocale` is required by
  // next-intl v4 to opt this server component into static rendering —
  // without it, `getTranslations` can silently fall back to
  // `defaultLocale` on routes that aren't covered by `setRequestLocale`
  // upstream.
  const locale = (await getLocale()) as Locale
  setRequestLocale(locale)
  const t = await getTranslations('Errors.notFound')

  // Pre-fetch the catalog name lookups server-side so the client
  // suggestion component doesn't have to hydrate the whole spec /
  // doc translation namespaces. PhotoSpec names are i18n records
  // (resolved via `localizeText`), DocSpec names go through a
  // dedicated translation namespace.
  const tDocNames = await getTranslations('Scanner.docSpecs')
  const specNames: Record<string, I18nText | string> = {}
  for (const spec of BUILTIN_PHOTO_SPECS) specNames[spec.id] = spec.name
  const docNames: Record<string, string> = {}
  for (const doc of SCANNER_DOC_SPECS) {
    docNames[doc.id] = tDocNames(doc.id as Parameters<typeof tDocNames>[0])
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6 px-6 pt-16 pb-24">
          <p className="font-mono text-xs tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
            404
          </p>
          <h1
            className="font-semibold tracking-tight text-balance text-[var(--color-text)]"
            style={{
              fontSize: 'var(--text-display-2)',
              lineHeight: 'var(--text-display-2--line-height)',
            }}
          >
            {t('title')}
          </h1>
          <p className="text-[var(--color-text-mute)] text-[var(--text-body-lg)]">{t('body')}</p>

          <NotFoundSuggestion locale={locale} specNames={specNames} docNames={docNames} />

          <nav
            aria-label={t('helpful.heading')}
            className="mt-2 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]"
          >
            <header className="mb-3">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t('helpful.heading')}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-mute)]">{t('helpful.subtitle')}</p>
            </header>
            <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
              {(
                [
                  { key: 'home', path: '/' },
                  { key: 'studio', path: '/studio' },
                  { key: 'scanner', path: '/scanner' },
                  { key: 'sizes', path: '/sizes' },
                  { key: 'scannerDocs', path: '/scanner' },
                ] as const
              ).map((link) => (
                <li key={`${link.key}-${link.path}`}>
                  <Link
                    href={{ pathname: link.path }}
                    className="group inline-flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]/40"
                  >
                    <span>{t(`helpful.${link.key}` as Parameters<typeof t>[0])}</span>
                    <ArrowRight
                      className="size-3.5 text-[var(--color-text-weak)] transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-wrap gap-3">
            <Link
              href={{ pathname: '/' }}
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
            >
              {t('actions.home')}
            </Link>
            <Link
              href={{ pathname: '/studio' }}
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-divider)]"
            >
              {t('actions.studio')}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
