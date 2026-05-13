import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PerfRunner } from '@/features/perf/perf-runner'

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

// Available in dev and in production builds when the operator explicitly
// opts in via NEXT_PUBLIC_ENABLE_DEV_PAGES=1 (e.g. `NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm build && pnpm start`
// for perf measurements). Not linked anywhere — accessible only by URL.
const allow =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES === '1'

export const dynamic = 'force-static'

/**
 * Dev-only segmentation benchmark page.
 *
 * Hidden by default. To collect production-mode numbers, build with
 * `NEXT_PUBLIC_ENABLE_DEV_PAGES=1` and visit /<locale>/dev/perf.
 */
export default function PerfPage() {
  if (!allow) notFound()
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
          Dev tools
        </p>
        <h1
          className="mt-2 font-semibold tracking-tight text-[var(--color-text)]"
          style={{ fontSize: 'var(--text-display-3)' }}
        >
          Segmentation benchmark
        </h1>
        <p className="mt-2 text-[var(--color-text-mute)]">
          Loads MODNet, runs N inference passes on a single photo, and reports init / mean / P50 /
          P95 timings. Numbers are copied into <code>docs/PLAN.md §6</code>.
        </p>
      </header>
      <PerfRunner />
    </main>
  )
}
