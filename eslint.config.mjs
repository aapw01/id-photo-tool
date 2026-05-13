import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FlatCompat } from '@eslint/eslintrc'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'

/**
 * Next.js 15.5 ships `eslint-config-next` as legacy `.eslintrc`-style
 * preset objects (`{ extends: [...], rules: {...} }`), not the new
 * flat-config arrays. We bridge them with FlatCompat so the rest of
 * this file can stay in flat-config form.
 *
 * (Next 16's `eslint-config-next` exports flat-config arrays directly
 * — once we re-upgrade we can drop FlatCompat and `import`
 * `eslint-config-next/core-web-vitals` straight back into the array.)
 */
const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
})

const eslintConfig = defineConfig([
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.open-next/**',
    '.wrangler/**',
    '.playwright-cli/**',
  ]),
])

export default eslintConfig
