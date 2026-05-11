import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
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
