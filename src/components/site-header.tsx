import { useTranslations } from 'next-intl'
import { ArrowUpRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { GitHubIcon } from '@/components/brand-icons'

export function SiteHeader() {
  const t = useTranslations('Nav')
  const tCommon = useTranslations('Common')

  const navItems = [
    { href: '/studio', label: t('studio') },
    { href: '/sizes', label: t('sizes') },
    { href: '/paper', label: t('paper') },
    { href: '/templates', label: t('templates') },
  ] as const

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="-ml-1 inline-flex items-center rounded-[var(--radius-md)] px-1 py-1"
        >
          <Logo />
        </Link>

        <nav aria-label="primary" className="hidden md:flex">
          <ul className="flex items-center gap-1 text-sm">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-mute)] transition-colors hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <a
            href="https://github.com/pixfit/pixfit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] px-3 text-sm text-[var(--color-text-mute)] hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]"
          >
            <GitHubIcon className="size-4" />
            <span className="hidden lg:inline">{t('github')}</span>
            <ArrowUpRight className="size-3 opacity-60 lg:hidden" aria-hidden="true" />
          </a>
          <LanguageSwitcher />
          <Link
            href="/studio"
            className="ml-2 inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
          >
            {tCommon('openStudio')}
          </Link>
        </div>
      </div>
    </header>
  )
}
