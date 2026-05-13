import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration.
 *
 * `esbuild.jsx: 'automatic'` is set explicitly here (not inherited
 * from tsconfig.json) because Next.js 15 keeps rewriting tsconfig's
 * `jsx` field to `"preserve"` on every `next build` — which then
 * breaks Vite/rolldown's import analysis ("Failed to parse source
 * for import analysis... If you use tsconfig.json, make sure to not
 * set jsx to preserve."). Locking the transform here keeps Vitest
 * independent of whatever Next decides to write into tsconfig.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['**/*.d.ts', '**/*.config.*', '.next/**', 'node_modules/**'],
    },
  },
})
