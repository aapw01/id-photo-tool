'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

interface LocaleErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Locale-aware runtime error boundary. Mounted automatically by
 * Next.js when a Server Component or render-time client component
 * throws inside `[locale]/*`. Hands the user a "Try again" CTA
 * (calls `reset()`) and a fallback link to the locale home page.
 */
export default function LocaleError({ error, reset }: LocaleErrorProps) {
  const t = useTranslations('Errors.runtime')

  useEffect(() => {
    // Keep a single console trace per error instance — useful in
    // dev tools while staying out of users' way in production.
    console.warn('[pixfit] route error', error)
  }, [error])

  const digest =
    process.env.NODE_ENV === 'development' ? (error.digest ?? error.message) : undefined

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-5 text-center">
        <p className="font-mono text-xs tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
          500
        </p>
        <h1
          className="font-semibold tracking-tight text-[var(--color-text)]"
          style={{
            fontSize: 'var(--text-display-3)',
            lineHeight: 'var(--text-display-3--line-height)',
          }}
        >
          {t('title')}
        </h1>
        <p className="text-[var(--color-text-mute)] text-[var(--text-body-lg)]">{t('body')}</p>
        {digest ? (
          <p className="font-mono text-xs break-all text-[var(--color-text-weak)]">{digest}</p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>{t('actions.retry')}</Button>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-divider)]"
          >
            {t('actions.home')}
          </Link>
        </div>
      </div>
    </main>
  )
}
