import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

/**
 * Localised 404 page. Triggered when a deeply-nested route under
 * `/[locale]/...` matches the locale segment but no route after it.
 *
 * `metadata` is intentionally minimal — Next.js renders this file
 * with the parent layout, so it inherits `noindex` via the parent's
 * robots header in production.
 */
export default async function LocaleNotFound() {
  // next-intl falls back to the default locale here because not-found
  // does not receive params.
  const t = await getTranslations('Errors.notFound')
  const tNav = await getTranslations('Nav')

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
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
            >
              {t('actions.home')}
            </Link>
            <Link
              href="/studio"
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-divider)]"
            >
              {tNav('studio')}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
