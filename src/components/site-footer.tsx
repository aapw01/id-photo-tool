import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { getPhotoSpec } from '@/data/photo-specs'
import { localizeText } from '@/lib/i18n-text'

const PRODUCT_LINKS = [{ href: '/studio', key: 'studio' }] as const

const BROWSE_LINKS = [
  { href: '/sizes', key: 'sizes' },
  { href: '/paper', key: 'paper' },
  { href: '/templates', key: 'templates' },
] as const

const LEGAL_LINKS = [
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
] as const

/**
 * Hand-curated short list of the highest-search-volume specs. We avoid
 * dumping all 28 builtins into the footer (looks spammy and dilutes
 * link equity) — these six cover the long-tail queries we most want
 * to rank for: US visa, Schengen visa, UK visa, Japan visa, Chinese
 * national ID, and the cn-1inch / cn-2inch wallet sizes.
 */
const POPULAR_SPEC_IDS = [
  'us-visa',
  'schengen',
  'uk-visa',
  'jp-visa',
  'cn-id-card',
  'cn-1inch',
] as const

export function SiteFooter() {
  const t = useTranslations('Footer')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const year = new Date().getFullYear()

  const popularSpecs = POPULAR_SPEC_IDS.map((id) => getPhotoSpec(id))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((spec) => ({
      id: spec.id,
      name: localizeText(spec.name, locale),
    }))

  return (
    <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo iconOnly className="shrink-0" />
            <div>
              <div className="font-medium text-[var(--color-text)]">{tCommon('brand')}</div>
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

          <FooterColumn heading={t('groups.popular')}>
            {popularSpecs.map((spec) => (
              <FooterLink key={spec.id} href={`/sizes/${spec.id}`}>
                {spec.name}
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
