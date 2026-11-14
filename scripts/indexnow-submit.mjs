#!/usr/bin/env node

/**
 * Submit Pixfit URLs to IndexNow after a production deployment.
 *
 * This script is intentionally manual. It is not imported by Next.js and does
 * not add a request to the page or build runtime. With no URL arguments it
 * reads the production sitemap; passing URLs submits only those URLs.
 *
 * Examples:
 *   pnpm seo:indexnow --dry-run
 *   pnpm seo:indexnow https://pix-fit.com/en https://pix-fit.com/en/studio
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const SITE_URL = (process.env.INDEXNOW_SITE_URL || 'https://pix-fit.com').replace(/\/+$/, '')
const SITEMAP_URL = process.env.INDEXNOW_SITEMAP_URL || `${SITE_URL}/sitemap.xml`
const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow'
const KEY_PATH = resolve(import.meta.dirname, '..', 'public/indexnow-key.txt')
const KEY_LOCATION = process.env.INDEXNOW_KEY_LOCATION || `${SITE_URL}/indexnow-key.txt`

function usage() {
  console.log(`Usage: pnpm seo:indexnow -- [--dry-run] [URL ...]

Without URL arguments, all URLs are read from ${SITEMAP_URL}.
Environment overrides: INDEXNOW_SITE_URL, INDEXNOW_SITEMAP_URL,
INDEXNOW_ENDPOINT, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION.`)
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  const showHelp = argv.includes('--help') || argv.includes('-h')
  const urls = argv.filter(
    (arg) => arg !== '--' && arg !== '--dry-run' && arg !== '--help' && arg !== '-h',
  )
  return { dryRun, showHelp, urls }
}

function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gim)].map((match) => match[1])
}

function normalizeUrls(urls) {
  const normalized = urls.map((value) => new URL(value).toString())
  const invalid = normalized.filter(
    (value) => !value.startsWith(`${SITE_URL}/`) && value !== SITE_URL,
  )
  if (invalid.length) {
    throw new Error(`URL must belong to ${SITE_URL}: ${invalid[0]}`)
  }
  return [...new Set(normalized)]
}

async function loadUrls(explicitUrls) {
  if (explicitUrls.length) return normalizeUrls(explicitUrls)

  const response = await fetch(SITEMAP_URL, { headers: { accept: 'application/xml' } })
  if (!response.ok) {
    throw new Error(`Sitemap request failed: ${response.status} ${response.statusText}`)
  }
  const urls = normalizeUrls(extractSitemapUrls(await response.text()))
  if (!urls.length) throw new Error(`No <loc> entries found in ${SITEMAP_URL}`)
  return urls
}

async function main() {
  const { dryRun, showHelp, urls: explicitUrls } = parseArgs(process.argv.slice(2))
  if (showHelp) {
    usage()
    return
  }

  const key = (process.env.INDEXNOW_KEY || (await readFile(KEY_PATH, 'utf8'))).trim()
  if (!key) throw new Error('IndexNow key is empty')

  const urls = await loadUrls(explicitUrls)
  const payload = {
    host: new URL(SITE_URL).host,
    key,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}Prepared ${urls.length} URL(s) for ${payload.host}`)
  if (dryRun) {
    console.log(JSON.stringify({ ...payload, key: '<redacted>' }, null, 2))
    return
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(
      `IndexNow request failed: ${response.status} ${response.statusText}${body ? `\n${body}` : ''}`,
    )
  }
  console.log(`IndexNow accepted the submission: ${response.status}${body ? ` ${body}` : ''}`)
}

main().catch((error) => {
  console.error(`IndexNow submission failed: ${error.message}`)
  process.exitCode = 1
})
