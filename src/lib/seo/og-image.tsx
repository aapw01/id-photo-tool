/**
 * Shared OG image template.
 *
 * Every per-route `opengraph-image.tsx` imports `renderOgImage` so the
 * 1200×630 cards keep a consistent layout (brand chip top-left, big
 * headline middle, optional eyebrow + meta line below). The actual
 * `ImageResponse` factory is exported so route files can stay tiny.
 *
 * Statically generated at build time — the satori bundle is only
 * needed during `next build`, not in the runtime worker. We avoid
 * any per-request data fetching so the cards never re-render at
 * runtime.
 */

import { ImageResponse } from 'next/og'

import { BRAND_PRIMARY_HEX, SITE_NAME, SITE_NAME_FULL } from './site-config'

/** Standard OG card size — also exported per-route as `size`. */
export const OG_SIZE = { width: 1200, height: 630 } as const

/** `image/png` — exported per-route as `contentType`. */
export const OG_CONTENT_TYPE = 'image/png'

export interface OgImageOpts {
  /** Big middle line; rendered as the H1-equivalent of the card. */
  headline: string
  /**
   * Small eyebrow line above the headline. Used for category labels
   * (e.g. the spec slug, the doc type, "BLOG"). Optional.
   */
  eyebrow?: string
  /**
   * One-line subtitle under the headline. Used for the precise size
   * ("51 × 51 mm · 600 × 600 px") or article publication date.
   * Optional.
   */
  subtitle?: string
  /**
   * Bottom-right "meta" line; commonly "pix-fit.com" + locale tag.
   * Optional, defaults to the SITE_NAME_FULL.
   */
  meta?: string
}

/** Render the shared OG card template into an `ImageResponse`. */
export function renderOgImage(opts: OgImageOpts): ImageResponse {
  const meta = opts.meta ?? SITE_NAME_FULL
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: BRAND_PRIMARY_HEX,
            color: 'white',
            fontSize: 32,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          P
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {SITE_NAME}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 1056,
        }}
      >
        {opts.eyebrow ? (
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '0.18em',
              color: BRAND_PRIMARY_HEX,
              textTransform: 'uppercase',
            }}
          >
            {opts.eyebrow}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
          }}
        >
          {opts.headline}
        </div>
        {opts.subtitle ? (
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              fontWeight: 400,
              color: '#475569',
              lineHeight: 1.3,
            }}
          >
            {opts.subtitle}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 22,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex' }}>{meta}</div>
        <div style={{ display: 'flex' }}>pix-fit.com</div>
      </div>
    </div>,
    { ...OG_SIZE },
  )
}
