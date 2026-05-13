import { ImageResponse } from 'next/og'

/**
 * Default Open Graph card (1200×630).
 *
 * `buildMetadata()` references `/og/default.png` as a fallback when a
 * caller doesn't supply a route-specific image. The App-Router
 * convention is to ship `opengraph-image.{tsx,png}` and Next will
 * register it for every descendant route automatically — much simpler
 * than maintaining a static binary in `public/`, and re-themes for
 * free when brand tokens change.
 */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Pixfit — Browser-based ID photo studio'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 60%, #a7f3d0 100%)',
        padding: '80px 96px',
        position: 'relative',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          fontSize: 28,
          color: '#047857',
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#10b981',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          P
        </div>
        Pixfit
      </div>

      <div
        style={{
          marginTop: 64,
          fontSize: 80,
          fontWeight: 700,
          color: '#0f172a',
          lineHeight: 1.05,
          letterSpacing: -2,
          maxWidth: 920,
        }}
      >
        ID photos, done right in your browser
      </div>

      <div
        style={{
          marginTop: 28,
          fontSize: 32,
          color: '#334155',
          lineHeight: 1.4,
          maxWidth: 920,
        }}
      >
        Cut out, swap the background, crop to spec, lay out for print — all without your photo ever
        leaving your device.
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 56,
          left: 96,
          right: 96,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 24,
          color: '#065f46',
        }}
      >
        <span>pix-fit.com</span>
        <span style={{ display: 'flex', gap: 24 }}>
          <span>Free · No login</span>
          <span>·</span>
          <span>100% in-browser</span>
        </span>
      </div>
    </div>,
    { ...size },
  )
}
