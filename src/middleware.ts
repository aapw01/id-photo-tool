import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

export default createMiddleware(routing)

export const config = {
  // Match every path except Next.js internals and static assets.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
