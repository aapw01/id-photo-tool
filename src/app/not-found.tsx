import Link from 'next/link'

import { DEFAULT_LOCALE } from '@/lib/seo/site-config'

/**
 * Top-level fallback for paths that don't match any locale segment
 * (next-intl middleware redirects unknown locales, but this still
 * catches direct hits like `/foo` or `/`). The detailed, fully
 * localised 404 lives at `[locale]/not-found.tsx`.
 *
 * This page renders outside of `NextIntlClientProvider` and therefore
 * has no message catalogue — we deliberately ship a short English
 * fallback and point the user at the locale-prefixed routes where the
 * real localisation kicks in.
 */
export default function RootNotFound() {
  const fallbackHref = `/${DEFAULT_LOCALE}`
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", "Microsoft YaHei", sans-serif',
          background: '#fafaf9',
          color: '#0c0a09',
        }}
      >
        <main
          style={{
            maxWidth: '420px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: '12px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#047857',
              margin: 0,
            }}
          >
            404
          </p>
          <h1 style={{ fontSize: '28px', marginTop: '12px', marginBottom: '12px' }}>
            Page not found
          </h1>
          <p
            style={{
              color: '#57534e',
              marginBottom: '12px',
              fontSize: '15px',
            }}
          >
            The page you are looking for could not be found.
          </p>
          <p
            style={{
              color: '#78716c',
              marginBottom: '24px',
              fontSize: '13px',
            }}
          >
            Try adding a locale prefix — for example <code>/zh-Hans</code> or <code>/en</code>.
          </p>
          <Link
            href={fallbackHref}
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#10b981',
              color: '#fff',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Back to Pixfit
          </Link>
        </main>
      </body>
    </html>
  )
}
