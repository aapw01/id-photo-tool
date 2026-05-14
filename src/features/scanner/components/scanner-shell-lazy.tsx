'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only lazy wrapper around ScannerShell.
 *
 * Same rationale as `studio-workspace-lazy.tsx`: `/scanner` is a pure
 * browser tool (S3+ will pull in OpenCV.js, jsPDF, large canvas
 * pipelines), so SSR-rendering the workspace pays no SEO dividend —
 * the SEO content lives in the surrounding page chrome and the
 * `seoIntro` section — while burning meaningful CPU on the edge.
 *
 * `next/dynamic({ ssr: false })` collapses the SSR cost of `/scanner`
 * to just header + h1 + seoIntro + footer, comfortably under
 * Cloudflare Workers Free's 10 ms per-request CPU ceiling.
 *
 * The wrapper must itself be a client component because
 * `dynamic({ ssr: false })` cannot be called directly from a server
 * component.
 */
const ScannerShell = dynamic(
  () => import('./scanner-shell').then((m) => ({ default: m.ScannerShell })),
  {
    ssr: false,
    loading: () => null,
  },
)

export function ScannerShellLazy() {
  return <ScannerShell />
}
