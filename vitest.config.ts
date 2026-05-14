import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration.
 *
 * Vite 8 replaced its internal esbuild transform with Oxc/rolldown, so
 * the older `esbuild.jsx: 'automatic'` option is now silently ignored
 * ("Both esbuild and oxc options were set..."). We have to drive the
 * Oxc plugin directly to get JSX-aware transforms — without this, any
 * `.tsx` file that gets pulled into the SSR-style module graph slips
 * past `vite:oxc` and crashes `vite:import-analysis` with
 * "Failed to parse source for import analysis... If you use
 * tsconfig.json, make sure to not set jsx to preserve."
 *
 * Setting `oxc.jsx.runtime: 'automatic'` mirrors what we used to ask
 * esbuild for: emit `react/jsx-runtime` imports so we don't need a
 * stray `import React` in every test/component. The matching
 * `include` widens Oxc's default to also cover `.ts` files so the
 * default `.js` exclusion doesn't accidentally skip TypeScript
 * sources when they're routed through the SSR pipeline.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
    include: /\.(m?[jt]sx?)$/,
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
