import { Inter, JetBrains_Mono } from 'next/font/google'

/**
 * Pixfit 字体加载
 *
 * 说明：
 *  - `next/font/google` 会在构建时把字体下载并自托管化（部署后浏览器请求落到我们自己的域名）。
 *  - 中文字体走系统优先 + Noto SC/TC 兜底，不在 next/font 中加载（体积过大，未做子集化时不划算）。
 *  - 详细策略见 docs/DESIGN.md §3.3 与 docs/tasks/M1.md T09/T10。
 */

export const fontSans = Inter({
  variable: '--font-app-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const fontMono = JetBrains_Mono({
  variable: '--font-app-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
})
