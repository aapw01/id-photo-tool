import { useTranslations } from 'next-intl'
import { Wand2 } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { SiteMobileNav } from '@/components/site-mobile-nav'

export function SiteHeader() {
  const t = useTranslations('Nav')
  const tCommon = useTranslations('Common')

  const navItems = [
    { href: '/studio', label: t('studio') },
    { href: '/scanner', label: t('scanner') },
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

        <nav aria-label={t('a11y.primary')} className="hidden md:flex">
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
          <LanguageSwitcher />
          <Link
            href="/studio"
            data-warmup-segmentation
            aria-label={tCommon('openStudio')}
            className="ml-2 inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)] sm:px-4"
          >
            <Wand2 className="size-4 sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">{tCommon('openStudio')}</span>
          </Link>
          <SiteMobileNav />
        </div>
      </div>
    </header>
  )
}
