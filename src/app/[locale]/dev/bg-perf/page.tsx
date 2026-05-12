import { notFound } from 'next/navigation'

import { BgPerfRunner } from '@/features/perf/bg-perf-runner'

const allow =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES === '1'

export const dynamic = 'force-static'

/**
 * Dev-only background-swap benchmark page.
 *
 * Synthesises a 512×768 test photo + mask so the harness doesn't need
 * MODNet to be loaded — handy for measuring the M3 swap path in
 * isolation. Numbers feed `docs/PLAN.md §6.7`.
 */
export default function BgPerfPage() {
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
          Background swap benchmark
        </h1>
        <p className="mt-2 text-[var(--color-text-mute)]">
          Measures how long `compositeOnto` takes once `extractForeground` has cached the cutout.
          Target: P50 &lt; 30 ms, P95 &lt; 50 ms (PRD §5.3).
        </p>
      </header>
      <BgPerfRunner />
    </main>
  )
}
