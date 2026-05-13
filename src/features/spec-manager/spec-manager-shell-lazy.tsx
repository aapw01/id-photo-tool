'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only lazy wrapper around SpecManagerShell.
 *
 * Same rationale as `studio-workspace-lazy.tsx`: the spec manager
 * is a pure browser tool (it reads/writes localStorage for custom
 * specs, drives a Zustand store, opens edit dialogs). Server-side
 * rendering this entire tree just so Cloudflare Workers can throw
 * it away on hydration is a poor trade — the SSR pass was the
 * second-largest contributor to the server function bundle (~330 KB)
 * after `@vercel/og`, and a non-trivial chunk of cold-start CPU on
 * the 10 ms free-tier budget.
 *
 * Wrapping the shell in `next/dynamic({ ssr: false })` makes Next
 * render `null` on the server for this subtree, so the `/specs`
 * route only pays SSR cost for the page chrome (site header, h1,
 * footer). The interactive shell itself ships in the client bundle
 * and mounts after hydration.
 */
const SpecManagerShell = dynamic(
  () =>
    import('./spec-manager-shell').then((m) => ({
      default: m.SpecManagerShell,
    })),
  {
    ssr: false,
    loading: () => null,
  },
)

export function SpecManagerShellLazy() {
  return <SpecManagerShell />
}
