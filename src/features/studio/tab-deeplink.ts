'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useStudioTabStore, type StudioTab } from './studio-tab-store'

const VALID_TABS: readonly StudioTab[] = ['background', 'size', 'layout', 'export']

/**
 * Parse a raw `?tab=` query value into a known StudioTab, or `null`
 * if it's missing / invalid / wrong shape. Lower-cased before lookup
 * so `?tab=Export` still works.
 */
export function parseTabParam(raw: string | null | undefined): StudioTab | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return null
  return (VALID_TABS as readonly string[]).includes(trimmed) ? (trimmed as StudioTab) : null
}

/**
 * Hook: keeps the `?tab=` search-param in sync with the studio-tab
 * store.
 *
 * Behaviour:
 *
 *   - On mount (client hydration), if `?tab=` is a valid tab, set the
 *     store to that tab. Otherwise leave the store at its default.
 *   - On every subsequent store change, push the new value to the
 *     URL via `router.replace` so the URL is shareable but the
 *     browser back button still returns to the prior page (not the
 *     prior tab).
 *
 * SSR-safe: the effects only run on the client.
 */
export function useTabDeeplink() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = useStudioTabStore((s) => s.tab)
  const setTab = useStudioTabStore((s) => s.setTab)
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const parsed = parseTabParam(searchParams.get('tab'))
    if (parsed && parsed !== useStudioTabStore.getState().tab) {
      setTab(parsed)
    }
  }, [searchParams, setTab])

  useEffect(() => {
    if (!hydratedRef.current) return
    const current = searchParams.get('tab')
    if (current === tab) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', tab)
    const qs = next.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [tab, pathname, router, searchParams])
}
