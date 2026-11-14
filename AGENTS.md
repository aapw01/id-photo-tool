<!-- BEGIN:nextjs-agent-rules -->

# Next.js 15 (App Router)

This project uses Next.js 15.5.18 with the App Router, React 19, and TypeScript 5.6 in strict mode. Conventions to follow:

- `params` is `Promise<...>` — always `await` it. Same goes for `searchParams`.
- For static `[locale]` pages, call `setRequestLocale(locale)` after validating the locale; required by next-intl v4 to opt into static rendering.
- Set `export const dynamicParams = false` on dynamic routes whose params come from a closed enum (`generateStaticParams`); otherwise unknown params return 500 on Vercel instead of a clean 404.
- Server components by default. Add `'use client'` only when you actually need browser-only APIs.

<!-- END:nextjs-agent-rules -->
