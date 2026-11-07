'use client'

import Script from 'next/script'

interface GoogleAnalyticsProps {
  measurementId?: string
}

/**
 * Optional GA4 loader. Nothing is rendered unless the build receives a
 * syntactically valid `NEXT_PUBLIC_GA_MEASUREMENT_ID` such as `G-ABC123`.
 * Page-view collection is disabled here because Vercel Analytics already
 * owns page views; this component is only for the explicit conversion
 * events emitted by `src/lib/analytics.ts`.
 */
export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return null

  const configScript = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', ${JSON.stringify(measurementId)}, { send_page_view: false });
  `

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="pixfit-ga4-config" strategy="afterInteractive">
        {configScript}
      </Script>
    </>
  )
}
