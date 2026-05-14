'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

/**
 * Client-only lazy wrapper around ScannerShell.
 *
 * Same rationale as `studio-workspace-lazy.tsx`: `/scanner` is a pure
 * browser tool (warp worker, jsPDF, large canvas pipelines), so
 * SSR-rendering the workspace pays no SEO dividend — the SEO content
 * lives in the surrounding page chrome and the `seoIntro` section —
 * while burning meaningful CPU on the edge.
 *
 * `next/dynamic({ ssr: false })` collapses the SSR cost of `/scanner`
 * to just header + h1 + seoIntro + footer, comfortably under
 * Cloudflare Workers Free's 10 ms per-request CPU ceiling.
 *
 * The `loading` placeholder mirrors the shell's three-column grid at
 * a fixed minimum height so a hard refresh doesn't briefly jump the
 * SEO content above the fold while the dynamic chunk loads (the
 * earlier `() => null` placeholder caused a noticeable layout shift).
 *
 * The wrapper must itself be a client component because
 * `dynamic({ ssr: false })` cannot be called directly from a server
 * component.
 */
const ScannerShell = dynamic(
  () => import('./scanner-shell').then((m) => ({ default: m.ScannerShell })),
  {
    ssr: false,
    loading: () => <ScannerShellSkeleton />,
  },
)

function ScannerShellSkeleton() {
  const t = useTranslations('Scanner.shell')
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t('loadingShell')}</span>
      <div aria-hidden="true" className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
        <div className="min-h-[480px] rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]" />
        <div className="min-h-[480px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <div className="min-h-[480px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </div>
    </div>
  )
}

export function ScannerShellLazy() {
  return <ScannerShell />
}
