#!/usr/bin/env node
/**
 * Verify that all locale message files share the same key shape.
 *
 * Locale `zh-Hans` is the canonical source of truth; every other locale must
 * contain exactly the same set of keys (no missing keys, no extra keys).
 *
 * Exits with code 1 on mismatch so it can gate CI / commit hooks.
 */
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const MESSAGES_DIR = resolve(REPO_ROOT, 'src/i18n/messages')
const BASE_LOCALE = 'zh-Hans'

function flatten(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key))
    } else {
      out.push(key)
    }
  }
  return out
}

const files = (await readdir(MESSAGES_DIR)).filter((f) => f.endsWith('.json'))
const all = {}
for (const f of files) {
  const locale = f.replace(/\.json$/, '')
  const content = JSON.parse(await readFile(resolve(MESSAGES_DIR, f), 'utf8'))
  all[locale] = new Set(flatten(content))
}

if (!all[BASE_LOCALE]) {
  console.error(`✗ Base locale "${BASE_LOCALE}" not found in ${MESSAGES_DIR}`)
  process.exit(1)
}

const base = all[BASE_LOCALE]
let hasError = false

for (const [locale, keys] of Object.entries(all)) {
  if (locale === BASE_LOCALE) continue
  const missing = [...base].filter((k) => !keys.has(k))
  const extra = [...keys].filter((k) => !base.has(k))
  if (missing.length || extra.length) {
    hasError = true
    console.error(`✗ ${locale}.json mismatch:`)
    if (missing.length) console.error('  missing keys:', missing)
    if (extra.length) console.error('  extra keys:  ', extra)
  } else {
    console.log(`✓ ${locale}.json matches ${BASE_LOCALE} (${keys.size} keys)`)
  }
}

console.log(`✓ ${BASE_LOCALE}.json has ${base.size} keys (baseline)`)
process.exit(hasError ? 1 : 0)
