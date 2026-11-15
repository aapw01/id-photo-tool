import Script from 'next/script'

const DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-3623293518183352'

interface GoogleAdSenseProps {
  clientId?: string
}

/**
 * Loads AdSense after the page becomes interactive. This component is only
 * mounted on informational pages; the editor, scanner, and compressor do
 * not load the advertising script so their workflows stay unobstructed.
 *
 * The client ID is public by design. An environment variable can override
 * the default when a different publisher account is used for a deployment.
 */
export function GoogleAdSense({ clientId }: GoogleAdSenseProps) {
  const resolvedClientId = clientId ?? process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
  const publisherId = resolvedClientId || DEFAULT_ADSENSE_CLIENT_ID

  if (!/^ca-pub-\d+$/.test(publisherId)) return null

  return (
    <Script
      id="google-adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`}
    />
  )
}
