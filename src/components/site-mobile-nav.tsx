'use client'

import { useState } from 'react'
import { MenuIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link, usePathname } from '@/i18n/navigation'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { GitHubIcon } from '@/components/brand-icons'

const NAV_KEYS = ['studio', 'sizes', 'paper', 'templates'] as const

const NAV_HREFS: Record<(typeof NAV_KEYS)[number], string> = {
  studio: '/studio',
  sizes: '/sizes',
  paper: '/paper',
  templates: '/templates',
}

export function SiteMobileNav() {
  const t = useTranslations('Nav')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t('menu.open')}
        className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-divider)] md:hidden"
      >
        <MenuIcon className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="md:hidden">
        <SheetHeader>
          <SheetTitle>{t('menu.title')}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <nav aria-label="mobile primary">
            <ul className="flex flex-col gap-1">
              {NAV_KEYS.map((key) => {
                const href = NAV_HREFS[key]
                const active = pathname === href
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-[var(--radius-md)] px-3 py-3 text-base transition-colors hover:bg-[var(--color-divider)] ${
                        active
                          ? 'bg-[var(--color-divider)] text-[var(--color-text)]'
                          : 'text-[var(--color-text-mute)]'
                      }`}
                    >
                      {t(key)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="mt-6 border-t border-[var(--color-border)] pt-4">
            <a
              href="https://github.com/pixfit/pixfit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
            >
              <GitHubIcon className="size-4" />
              <span>{t('github')}</span>
            </a>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
