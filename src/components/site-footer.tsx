import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'

export function SiteFooter() {
  const t = useTranslations('Footer')
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Logo iconOnly className="shrink-0" />
          <div>
            <div className="font-medium text-[var(--color-text)]">Pixfit · 像配</div>
            <div className="text-sm text-[var(--color-text-mute)]">{t('tagline')}</div>
          </div>
        </div>

        <nav aria-label="footer" className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/privacy"
            className="text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
          >
            {t('privacy')}
          </Link>
          <Link
            href="/terms"
            className="text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
          >
            {t('terms')}
          </Link>
          <a
            href="https://github.com/pixfit/pixfit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
          >
            {t('openSource')}
          </a>
        </nav>

        <p className="text-sm text-[var(--color-text-weak)]">{t('copy', { year })}</p>
      </div>
    </footer>
  )
}
