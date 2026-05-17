import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { getPhotoSpec } from '@/data/photo-specs'
import { DOC_SPECS, DOC_SPEC_GROUP_ORDER } from '@/features/scanner/lib/doc-specs'
import { localizeText } from '@/lib/i18n-text'

/**
 * Site-wide footer index. Surfaces every public route grouped into
 * four product columns:
 *
 *   1. Studio    — workflow tabs (Background / Crop / Layout / Export)
 *                  + top-10 long-tail size landing pages
 *   2. Scanner   — every built-in DocSpec landing page (12 entries
 *                  rendered from `DOC_SPECS` so the column stays
 *                  honest if the data file grows)
 *   3. Specs     — collection index hubs (/sizes, /paper, /templates,
 *                  /specs)
 *   4. Resources — legal + GitHub + language switcher
 *
 * Markup is semantic: `<footer role="contentinfo">` plus one
 * `<nav aria-label>` per column so a screen reader can skip between
 * the four groups directly. Link labels come from the i18n bundles
 * so all three locales stay in lockstep.
 */

/**
 * Hand-curated top-10 long-tail spec ids that anchor the Studio
 * column. Order is search-volume-first (US visa / Schengen / UK / JP
 * / KR / CA visas; Chinese ID / 1-inch / 2-inch / passport). The
 * list is intentionally pinned here — `BUILTIN_PHOTO_SPECS.slice(0,
 * 10)` would surface low-traffic entries like exam formats first.
 */
const POPULAR_SPEC_IDS = [
  'us-visa',
  'schengen',
  'uk-visa',
  'jp-visa',
  'kr-visa',
  'ca-visa',
  'cn-id-card',
  'cn-1inch',
  'cn-2inch',
  'cn-passport',
] as const

/** Studio workflow tabs — wired to the `?tab=` deeplink convention. */
const STUDIO_TAB_LINKS = [
  { key: 'studioBackground', tab: 'background' },
  { key: 'studioCrop', tab: 'size' },
  { key: 'studioLayout', tab: 'layout' },
  { key: 'studioExport', tab: 'export' },
] as const

/** Spec catalog hubs — collection pages, not the per-spec details. */
const SPECS_LINKS = [
  { href: '/sizes', key: 'sizes' },
  { href: '/paper', key: 'paper' },
  { href: '/templates', key: 'templates' },
  { href: '/specs', key: 'specs' },
  { href: '/compress', key: 'compress' },
] as const

const LEGAL_LINKS = [
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
] as const

/**
 * Render the full footer. Server component — every state ride-along
 * (LanguageSwitcher) is a thin client island.
 */
export function SiteFooter() {
  const t = useTranslations('Footer')
  const tCommon = useTranslations('Common')
  const tDoc = useTranslations('Scanner.docSpecs')
  const locale = useLocale()
  const year = new Date().getFullYear()

  const popularSpecs = POPULAR_SPEC_IDS.map((id) => getPhotoSpec(id))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((spec) => ({
      id: spec.id,
      name: localizeText(spec.name, locale),
    }))

  // Render DocSpecs in canonical group order so the column reads
  // ID-cards → driver licenses → vehicle licenses → passport →
  // paper, matching the picker UI and not random data-file order.
  const orderedDocSpecs = DOC_SPEC_GROUP_ORDER.flatMap((group) =>
    DOC_SPECS.filter((s) => s.group === group),
  )

  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo iconOnly className="shrink-0" />
            <div>
              <div className="font-medium text-[var(--color-text)]">{tCommon('brand')}</div>
              <div className="mt-1 text-sm text-[var(--color-text-mute)]">{t('tagline')}</div>
            </div>
          </div>

          <FooterColumn heading={t('groups.studio')} ariaLabel={t('aria.studio')}>
            <FooterLink href="/studio">{t('links.studio')}</FooterLink>
            {STUDIO_TAB_LINKS.map((item) => (
              <FooterLink key={item.key} href={{ pathname: '/studio', query: { tab: item.tab } }}>
                {t(`links.${item.key}`)}
              </FooterLink>
            ))}
            <FooterDivider />
            {popularSpecs.map((spec) => (
              <FooterLink key={spec.id} href={`/sizes/${spec.id}`}>
                {spec.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading={t('groups.scanner')} ariaLabel={t('aria.scanner')}>
            <FooterLink href="/scanner">{t('links.scanner')}</FooterLink>
            <FooterDivider />
            {orderedDocSpecs.map((spec) => (
              <FooterLink key={spec.id} href={`/scanner/${spec.id}`}>
                {tDoc(spec.id as Parameters<typeof tDoc>[0])}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading={t('groups.specs')} ariaLabel={t('aria.specs')}>
            {SPECS_LINKS.map((item) => (
              <FooterLink key={item.key} href={item.href}>
                {t(`links.${item.key}`)}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading={t('groups.resources')} ariaLabel={t('aria.resources')}>
            {LEGAL_LINKS.map((item) => (
              <FooterLink key={item.key} href={item.href}>
                {t(`links.${item.key}`)}
              </FooterLink>
            ))}
            <li>
              <a
                href="https://github.com/aapw01/id-photo-tool"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-mute)] transition-colors hover:text-[var(--color-text)]"
              >
                {t('links.github')}
              </a>
            </li>
            <li className="pt-1">
              <LanguageSwitcher className="-ml-2.5" />
            </li>
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

function FooterColumn({
  heading,
  ariaLabel,
  children,
}: {
  heading: string
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-3">
      <h2 className="font-mono text-xs tracking-wide text-[var(--color-text-weak)] uppercase">
        {heading}
      </h2>
      <ul className="flex flex-col gap-2 text-sm">{children}</ul>
    </nav>
  )
}

type FooterLinkHref = React.ComponentProps<typeof Link>['href']

function FooterLink({ href, children }: { href: FooterLinkHref; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[var(--color-text-mute)] transition-colors hover:text-[var(--color-text)]"
      >
        {children}
      </Link>
    </li>
  )
}

function FooterDivider() {
  return <li className="my-1 h-px bg-[var(--color-border)]" aria-hidden="true" />
}
