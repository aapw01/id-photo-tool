import { ArrowRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

/**
 * Cross-surface "more tools" strip for the long-tail detail pages.
 *
 * Each detail page (sizes / scanner / compress) previously only linked
 * *within its own surface* (the related-specs row) plus a CTA into
 * Studio. That leaves the four tool surfaces weakly connected in the
 * internal link graph — a visitor (and Googlebot) on a "US visa photo
 * size" page had no in-content path to the Scanner or Compress tools.
 *
 * This component renders a compact `<nav>` linking to the *other three*
 * surface hubs, so link equity flows between the money pages and users
 * can hop tools. Link labels reuse the `Footer.links.*` bundle (present
 * in all 13 locales); the section heading is a short inline map so we
 * don't have to thread a new i18n key through every locale file.
 */

type Surface = 'studio' | 'sizes' | 'scanner' | 'compress'

const SURFACES: ReadonlyArray<{ key: Surface; href: string }> = [
  { key: 'studio', href: '/studio' },
  { key: 'sizes', href: '/sizes' },
  { key: 'scanner', href: '/scanner' },
  { key: 'compress', href: '/compress' },
]

/** "More tools" heading per locale (en is the fallback). */
const HEADING: Record<string, string> = {
  'zh-Hans': '更多工具',
  'zh-Hant': '更多工具',
  en: 'More tools',
  ja: 'その他のツール',
  ko: '다른 도구',
  es: 'Más herramientas',
  'pt-BR': 'Mais ferramentas',
  fr: 'Autres outils',
  de: 'Weitere Tools',
  ru: 'Другие инструменты',
  it: 'Altri strumenti',
  vi: 'Công cụ khác',
  ar: 'أدوات أخرى',
}

export function CrossSurfaceLinks({ current }: { current: Surface }) {
  const t = useTranslations('Footer')
  const locale = useLocale()
  const heading = HEADING[locale] ?? HEADING.en
  const items = SURFACES.filter((s) => s.key !== current)

  return (
    <nav aria-label={heading} className="mt-12 border-t border-[var(--color-border)] pt-10">
      <h2
        className="mb-6 text-[var(--color-text)]"
        style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
      >
        {heading}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((s) => (
          <li key={s.key}>
            <Link
              href={{ pathname: s.href }}
              className="group flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-primary-soft)] hover:bg-[var(--color-primary-soft)]/30"
            >
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t(`links.${s.key}`)}
              </span>
              <ArrowRight
                className="size-4 text-[var(--color-text-weak)] transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
