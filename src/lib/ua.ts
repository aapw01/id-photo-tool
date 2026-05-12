'use client'

import { useSyncExternalStore } from 'react'

/**
 * Returns true when the user-agent string belongs to the WeChat
 * in-app browser ("WeChat" exposes itself as `MicroMessenger` on all
 * platforms, including the iOS / Android / mac / Windows app shells).
 *
 * Pure function — safe in SSR and tests.
 */
export function isWeChatBrowser(ua: string | null | undefined): boolean {
  if (typeof ua !== 'string' || !ua) return false
  return /MicroMessenger/i.test(ua)
}

/**
 * Returns true for touch-only / coarse-pointer devices (most phones
 * and tablets). Falls back to UA sniffing when matchMedia is not
 * available (SSR, tests).
 */
export function isCoarsePointer(ua: string | null | undefined, matches?: boolean | null): boolean {
  if (typeof matches === 'boolean') return matches
  if (typeof ua !== 'string' || !ua) return false
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
}

/**
 * Hook: detects the WeChat in-app browser after hydration. Always
 * returns `false` during SSR so output is hydration-stable, then
 * upgrades to the real UA reading on the client via
 * `useSyncExternalStore`.
 */
function noopSubscribe(): () => void {
  return () => {}
}

function clientWeChatSnapshot(): boolean {
  if (typeof navigator === 'undefined') return false
  return isWeChatBrowser(navigator.userAgent)
}

function serverWeChatSnapshot(): boolean {
  return false
}

export function useIsWeChat(): boolean {
  return useSyncExternalStore(noopSubscribe, clientWeChatSnapshot, serverWeChatSnapshot)
}
