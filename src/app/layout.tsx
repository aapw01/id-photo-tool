import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pixfit · 像配',
  description: '浏览器内一站式证件照工作台 — 换底色、裁剪、排版、压缩、导出。',
}

// Root layout is a pass-through; locale-aware <html>/<body> live in `[locale]/layout.tsx`.
// Next.js 15+ permits this when the locale segment owns the document shell.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
