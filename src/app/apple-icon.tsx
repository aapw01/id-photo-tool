import { ImageResponse } from 'next/og'

/**
 * Code-generated apple-touch-icon: 180×180 PNG matching the favicon
 * visual treatment (Emerald square + white "P"). Apple's home-screen
 * shortcut prefers a solid square at this size.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#10b981',
        color: '#ffffff',
        fontSize: 120,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: -4,
      }}
    >
      P
    </div>,
    { ...size },
  )
}
