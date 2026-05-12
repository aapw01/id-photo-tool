'use client'

import { useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Crop, Download, LayoutGrid, Palette } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useStudioTabStore, type StudioTab } from './studio-tab-store'

interface BottomTabDef {
  id: StudioTab
  labelKey: 'background' | 'size' | 'layout' | 'export'
  Icon: typeof Crop
}

interface StudioBottomTabsProps {
  /** Called whenever the user taps a tab (after the store update). */
  onSelect?: (id: StudioTab) => void
}

const BOTTOM_TABS: readonly BottomTabDef[] = [
  { id: 'background', labelKey: 'background', Icon: Palette },
  { id: 'size', labelKey: 'size', Icon: Crop },
  { id: 'layout', labelKey: 'layout', Icon: LayoutGrid },
  { id: 'export', labelKey: 'export', Icon: Download },
]

/**
 * Bottom navigation bar shown only on ≤ md viewports. Mirrors the
 * desktop `StudioTabs` four tabs but as a fixed-bottom 4-button row
 * with lucide icons + label. Includes safe-area-inset-bottom for iOS.
 */
export function StudioBottomTabs({ onSelect }: StudioBottomTabsProps = {}) {
  const t = useTranslations('Studio.tabs')
  const tMobile = useTranslations('Studio.mobile')
  const tab = useStudioTabStore((s) => s.tab)
  const setTab = useStudioTabStore((s) => s.setTab)

  const handleSelect = useCallback(
    (id: StudioTab) => {
      setTab(id)
      onSelect?.(id)
    },
    [setTab, onSelect],
  )

  const refs = useRef<Record<StudioTab, HTMLButtonElement | null>>({
    background: null,
    size: null,
    layout: null,
    export: null,
  })

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const ids = BOTTOM_TABS.map((d) => d.id)
      const i = ids.indexOf(tab)
      if (i < 0) return
      let next: StudioTab | null = null
      if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length]!
      else if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length]!
      else if (e.key === 'Home') next = ids[0]!
      else if (e.key === 'End') next = ids[ids.length - 1]!
      if (next) {
        e.preventDefault()
        handleSelect(next)
        refs.current[next]?.focus()
      }
    },
    [tab, handleSelect],
  )

  return (
    <nav
      aria-label={tMobile('tabLabel')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        role="tablist"
        aria-label="Studio sections"
        onKeyDown={handleKey}
        className="mx-auto flex h-14 max-w-2xl items-stretch"
      >
        {BOTTOM_TABS.map(({ id, labelKey, Icon }) => {
          const isActive = id === tab
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[id] = el
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={t(labelKey)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleSelect(id)}
              style={{ touchAction: 'manipulation' }}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors',
                'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
                isActive
                  ? 'text-[var(--color-primary-dk)]'
                  : 'text-[var(--color-text-mute)] hover:text-[var(--color-text)]',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
