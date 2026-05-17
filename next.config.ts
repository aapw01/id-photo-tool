import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import createBundleAnalyzer from '@next/bundle-analyzer'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pixfit's canonical URLs are no-slash (`/sizes/us-visa`, not
  // `/sizes/us-visa/`); pin the default explicitly so a future Next
  // major or a config import can't flip this behind our back. Search
  // engines treat slash + no-slash as separate URLs, so we'd lose
  // half our link-equity if this drifted.
  trailingSlash: false,
}

export default withBundleAnalyzer(withNextIntl(nextConfig))
