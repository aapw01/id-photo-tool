import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { fontMono, fontSans } from '@/lib/fonts'
import { routing } from '@/i18n/routing'
import { Toaster } from '@/components/ui/sonner'
import { BRAND_PRIMARY_HEX, SITE_URL } from '@/lib/seo/site-config'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

/**
 * `metadataBase` anchors every per-route `generateMetadata` result so
 * Next can resolve relative OG / Twitter image paths against the
 * canonical host. Per-route `generateMetadata` still owns title /
 * description / canonical / alternates.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
}

/**
 * `viewport` + `themeColor` ride on the dedicated `viewport` export
 * since Next.js 14; keeping them here means every page inherits the
 * same crawler-friendly defaults without per-route boilerplate.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: BRAND_PRIMARY_HEX,
  colorScheme: 'light',
}

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <html lang={locale} className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
