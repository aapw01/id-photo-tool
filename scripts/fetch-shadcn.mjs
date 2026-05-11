#!/usr/bin/env node
/**
 * Pull shadcn/ui v4 components directly from the public registry.
 *
 * This bypasses the official `shadcn` CLI, which currently fails on Node 26
 * due to the @modelcontextprotocol/sdk + zod v4 ESM resolution bug (upstream
 * issue modelcontextprotocol/typescript-sdk#726, still open as of 2026-04).
 *
 * Usage:
 *   node scripts/fetch-shadcn.mjs button input label dialog tooltip sonner
 */
import { writeFile, mkdir, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const STYLE = 'new-york-v4'
const BASE = `https://ui.shadcn.com/r/styles/${STYLE}`
const REPO_ROOT = resolve(import.meta.dirname, '..')
const REGISTRY_PREFIX = `registry/${STYLE}/`

const components = process.argv.slice(2)
if (components.length === 0) {
  console.error('usage: node scripts/fetch-shadcn.mjs <component> [...components]')
  process.exit(1)
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function fetchOne(name) {
  const url = `${BASE}/${name}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  /** @type {{ name: string; dependencies?: string[]; registryDependencies?: string[]; files?: { path: string; content: string }[] }} */
  const data = await res.json()
  return data
}

async function applyComponent(name, written, deps, registryDeps) {
  const data = await fetchOne(name)
  for (const dep of data.dependencies ?? []) deps.add(dep)
  for (const dep of data.registryDependencies ?? []) registryDeps.add(dep)
  for (const file of data.files ?? []) {
    let relPath = file.path.startsWith(REGISTRY_PREFIX)
      ? file.path.slice(REGISTRY_PREFIX.length)
      : file.path
    // Map shadcn registry roots (`ui/...`, `hooks/...`, `lib/...`) to our
    // `components/ui`, `hooks`, `lib` aliases (see components.json).
    if (relPath.startsWith('ui/')) relPath = `components/${relPath}`
    const targetPath = resolve(REPO_ROOT, 'src', relPath)
    if (await exists(targetPath)) {
      console.log(`  · skip (exists) ${targetPath.replace(REPO_ROOT + '/', '')}`)
      continue
    }
    // Rewrite internal `@/registry/<style>/ui/...` imports to our alias.
    const rewritten = file.content.replace(/@\/registry\/[^/]+\/ui\//g, '@/components/ui/')
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, rewritten, 'utf8')
    written.push(targetPath.replace(REPO_ROOT + '/', ''))
  }
}

const visited = new Set()
const written = []
const deps = new Set()
const registryDeps = new Set()
const queue = [...components]

while (queue.length) {
  const name = queue.shift()
  if (visited.has(name)) continue
  visited.add(name)
  console.log(`→ ${name}`)
  await applyComponent(name, written, deps, registryDeps)
  for (const r of registryDeps) {
    if (!visited.has(r)) queue.push(r)
  }
}

console.log('\nWritten files:')
for (const f of written) console.log(`  ${f}`)

console.log('\nnpm dependencies to install:')
for (const d of deps) console.log(`  ${d}`)
