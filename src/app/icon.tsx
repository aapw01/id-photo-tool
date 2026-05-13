import { ImageResponse } from 'next/og'

/**
 * Code-generated favicon: a 32×32 rounded Emerald square with a white
 * "P" glyph. Using `ImageResponse` keeps the asset out of `public/`
 * so the build is reproducible from source and re-themes for free
 * when `BRAND_PRIMARY_HEX` changes.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
        fontSize: 22,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: -1,
        borderRadius: 7,
      }}
    >
      P
    </div>,
    { ...size },
  )
}
