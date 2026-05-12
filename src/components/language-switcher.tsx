'use client'

/**
 * Language switcher.
 *
 * Renders the active locale in the header and exposes a lightweight
 * dropdown menu (Vercel / Notion / Linear style) with the three
 * supported locales. We pick `DropdownMenu` over `Dialog` so screen
 * readers get the right `role="menu"` / `role="menuitemradio"` shape
 * without us having to wire ARIA attributes by hand, and to avoid
 * shipping a modal where a dropdown suffices.
 */

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Languages } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

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
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger
        aria-label={t('label')}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm text-[var(--color-text-mute)] transition-colors hover:bg-[var(--color-divider)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
          isPending && 'pointer-events-none opacity-60',
          className,
        )}
      >
        <Languages className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{tCommon(locale)}</span>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          aria-label={t('label')}
          className={cn(
            'z-50 min-w-[10rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-md)]',
            'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
          )}
        >
          {routing.locales.map((code) => {
            const active = code === locale
            return (
              <DropdownMenuPrimitive.Item
                key={code}
                onSelect={() => switchTo(code)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm transition-colors outline-none',
                  'data-[highlighted]:bg-[var(--color-divider)] data-[highlighted]:text-[var(--color-text)]',
                  active ? 'text-[var(--color-primary-dk)]' : 'text-[var(--color-text-mute)]',
                )}
              >
                <span>{tCommon(code)}</span>
                {active ? (
                  <Check className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                ) : null}
              </DropdownMenuPrimitive.Item>
            )
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
