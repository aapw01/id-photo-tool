import './globals.css'

// Root layout is a pass-through; locale-aware <html>/<body> live in `[locale]/layout.tsx`,
// and metadata is owned by each route's `generateMetadata()` so the locale is honoured.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
