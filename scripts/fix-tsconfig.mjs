#!/usr/bin/env node
/**
 * Restore `jsx: "react-jsx"` in tsconfig.json after a Next.js build.
 *
 * Next.js 15+ insists on rewriting tsconfig's `jsx` field to
 * `"preserve"` on every `next build` (Next ships its own SWC transform
 * so it doesn't actually *need* TS to emit JSX). But the moment that
 * lands, Vitest / Vite 8 / Rolldown's SSR transform refuses to parse
 * `.tsx` files:
 *
 *   Error: Failed to parse source for import analysis...
 *   If you use tsconfig.json, make sure to not set jsx to preserve.
 *
 * Wiring this script as a `postbuild` / `postcf:build` hook keeps the
 * checked-in tsconfig stable and Vitest happy without giving up `next
 * build` locally.
 *
 * Idempotent: if `jsx` is already `react-jsx`, this is a no-op.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TSCONFIG = resolve(ROOT, 'tsconfig.json')

const content = readFileSync(TSCONFIG, 'utf8')
const fixed = content.replace(/"jsx":\s*"preserve"/, '"jsx": "react-jsx"')

if (content === fixed) {
  // already correct; nothing to do
  process.exit(0)
}

writeFileSync(TSCONFIG, fixed)
console.log('[fix-tsconfig] restored "jsx": "react-jsx" after Next build')
