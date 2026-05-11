'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Languages } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('LanguageSwitcher')
  const tCommon = useTranslations('Common.languages')
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function switchTo(next: Locale) {
    if (next === locale) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger
        aria-label={t('label')}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm text-[var(--color-text-mute)] hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]',
          isPending && 'pointer-events-none opacity-60',
          className,
        )}
      >
        <Languages className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{tCommon(locale)}</span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          aria-label={t('label')}
          className="fixed top-1/2 left-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-lg)]"
        >
          <div className="px-3 py-2 text-xs tracking-wider text-[var(--color-text-mute)] uppercase">
            {t('label')}
          </div>
          <ul role="listbox">
            {routing.locales.map((code) => (
              <li key={code}>
                <button
                  role="option"
                  aria-selected={code === locale}
                  onClick={() => switchTo(code)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-left text-sm hover:bg-[var(--color-divider)]',
                    code === locale &&
                      'bg-[var(--color-primary-soft)] text-[var(--color-primary-dk)]',
                  )}
                >
                  <span>{tCommon(code)}</span>
                  {code === locale ? (
                    <span className="font-mono text-xs">{t('current')}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
