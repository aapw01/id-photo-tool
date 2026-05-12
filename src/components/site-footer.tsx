import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'

const PRODUCT_LINKS = [
  { href: '/studio', key: 'studio' },
  { href: '/specs', key: 'specs' },
] as const

const BROWSE_LINKS = [
  { href: '/sizes', key: 'sizes' },
  { href: '/paper', key: 'paper' },
  { href: '/templates', key: 'templates' },
] as const

const LEGAL_LINKS = [
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
] as const

export function SiteFooter() {
  const t = useTranslations('Footer')
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo iconOnly className="shrink-0" />
            <div>
              <div className="font-medium text-[var(--color-text)]">Pixfit · 像配</div>
              <div className="mt-1 text-sm text-[var(--color-text-mute)]">{t('tagline')}</div>
            </div>
          </div>

          <FooterColumn heading={t('groups.product')}>
            {PRODUCT_LINKS.map((item) => (
              <FooterLink key={item.key} href={item.href}>
                {t(`links.${item.key}`)}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading={t('groups.browse')}>
            {BROWSE_LINKS.map((item) => (
              <FooterLink key={item.key} href={item.href}>
                {t(`links.${item.key}`)}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading={t('groups.legal')}>
            {LEGAL_LINKS.map((item) => (
              <FooterLink key={item.key} href={item.href}>
                {t(`links.${item.key}`)}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading={t('groups.about')}>
            <a
              href="https://github.com/pixfit/pixfit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-mute)] transition-colors hover:text-[var(--color-text)]"
            >
              {t('links.github')}
            </a>
          </FooterColumn>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-[var(--color-border)] pt-6 text-sm text-[var(--color-text-weak)] md:flex-row md:items-center">
          <p>{t('copy', { year })}</p>
          <p className="font-mono text-xs">{t('openSource')}</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-mono text-xs tracking-wide text-[var(--color-text-weak)] uppercase">
        {heading}
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {Array.isArray(children) ? (
          children.map((child, idx) => <li key={idx}>{child}</li>)
        ) : (
          <li>{children}</li>
        )}
      </ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[var(--color-text-mute)] transition-colors hover:text-[var(--color-text)]"
    >
      {children}
    </Link>
  )
}
