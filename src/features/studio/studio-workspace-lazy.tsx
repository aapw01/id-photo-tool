'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only lazy wrapper around StudioWorkspace.
 *
 * Why this exists
 * ---------------
 * `/studio` is a pure browser tool — every meaningful interaction
 * (cut-out, crop, layout, export) runs on canvas in the browser, so
 * server-side rendering the entire workspace tree pays *no* SEO
 * dividend (crawlers never see the live editor anyway) and burns
 * meaningful CPU on the edge.
 *
 * On Cloudflare Workers Free the request budget is 10 ms of CPU per
 * request. React 19 SSR over the full StudioWorkspace component tree
 * — tab system, dropzone, file-info card, segmentation feedback strip,
 * comparison-slider, format cards, bottom tab bar, etc. — easily
 * exceeds that, surfacing as:
 *
 *   GET /<locale>/studio - Exceeded CPU Limit
 *   Error: Worker exceeded CPU time limit.
 *
 * → end-user error 1102.
 *
 * `next/dynamic({ ssr: false })` makes Next render *nothing* on the
 * server for this subtree (no component function call, no RSC payload
 * for the leaves), so the SSR cost of /studio collapses to just the
 * page chrome (header, h1, SEO intro, footer), which trivially fits
 * inside the free-tier CPU budget. The workspace itself ships in the
 * client bundle and mounts after hydration.
 *
 * Trade-off: a brief empty area below the h1 on first paint before
 * the workspace JavaScript loads. Acceptable for a tool surface
 * (vs. an SEO-critical content page).
 *
 * To use this from a server component we must hop through this
 * client wrapper — `dynamic({ ssr: false })` cannot be called
 * directly from a server component.
 */
const StudioWorkspace = dynamic(
  () => import('./studio-workspace').then((m) => ({ default: m.StudioWorkspace })),
  {
    ssr: false,
    loading: () => null,
  },
)

export function StudioWorkspaceLazy() {
  return <StudioWorkspace />
}
