#!/usr/bin/env node
/**
 * Pull OpenCV.js 4.10.0 (~8 MB) into `public/vendor/opencv/4.10.0/`.
 *
 * Why self-host rather than CDN-load at runtime:
 *   - docs.opencv.org is intermittently unreachable from mainland China
 *     dev environments (reported on dev as `Failed to load OpenCV.js`).
 *   - Same-origin hosting lets us hit our own edge cache / Cloudflare
 *     and unifies cache-control with the rest of `public/`.
 *
 * Mirrors / fallback chain:
 *   1. docs.opencv.org — canonical upstream from the OpenCV project.
 *   2. cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0 — `dist/opencv.js`
 *      is the same compiled artifact (verified by checksum locally),
 *      and jsdelivr is China-reachable via its `cdn.jsdelivr.net`
 *      mainland POPs.
 *
 * Idempotent: existing file > MIN_SIZE is left untouched. Use --force
 * to re-download (e.g. when bumping the pinned version).
 *
 * Usage:
 *   pnpm opencv:fetch
 *   pnpm opencv:fetch --force
 */
import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const OPENCV_VERSION = '4.10.0'
const TARGET = resolve(REPO_ROOT, `public/vendor/opencv/${OPENCV_VERSION}/opencv.js`)
// OpenCV.js 4.10.0 sits around 8.6 MB; below 5 MB means we got an
// HTML error page or a partial response, never the real bundle.
const MIN_SIZE = 5 * 1024 * 1024
const MAX_ATTEMPTS = 2

const SOURCES = [
  `https://docs.opencv.org/${OPENCV_VERSION}/opencv.js`,
  `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@${OPENCV_VERSION}/dist/opencv.js`,
]

const FORCE = process.argv.includes('--force')

async function downloadViaFetch(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < MIN_SIZE) {
    throw new Error(`Payload too small (${buf.byteLength} bytes); likely an error page`)
  }
  return buf
}

// curl fallback — Node's fetch occasionally chokes on slow TLS hops
// from CN dev networks; curl with --retry handles partial reads better.
async function downloadViaCurl(url) {
  await mkdir(dirname(TARGET), { recursive: true })
  const tmpPath = `${TARGET}.part`
  return await new Promise((res, rej) => {
    const child = spawn(
      'curl',
      ['-fsSL', '--retry', '2', '--retry-delay', '2', '--max-time', '300', '-o', tmpPath, url],
      { stdio: 'inherit' },
    )
    child.on('error', rej)
    child.on('exit', async (code) => {
      if (code !== 0) {
        await unlink(tmpPath).catch(() => {})
        rej(new Error(`curl exited with code ${code}`))
        return
      }
      try {
        const buf = await readFile(tmpPath)
        await unlink(tmpPath).catch(() => {})
        if (buf.byteLength < MIN_SIZE) {
          rej(new Error(`curl payload too small (${buf.byteLength} bytes)`))
          return
        }
        res(buf)
      } catch (err) {
        rej(err)
      }
    })
  })
}

async function download() {
  let lastErr
  for (const url of SOURCES) {
    console.log(`→ Trying ${url}`)
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const transport = attempt === 1 ? 'fetch' : 'curl'
      try {
        const buf = transport === 'fetch' ? await downloadViaFetch(url) : await downloadViaCurl(url)
        console.log(`✓ Downloaded via ${transport}`)
        return buf
      } catch (err) {
        lastErr = err
        console.warn(`  attempt ${attempt}/${MAX_ATTEMPTS} (${transport}) failed: ${err.message}`)
      }
    }
    console.warn(`  giving up on this source, trying next…`)
  }
  throw new Error(
    `All ${SOURCES.length} sources failed. Last error: ${lastErr?.message}\n` +
      `Workarounds:\n` +
      `  - HTTPS_PROXY=http://127.0.0.1:7890 pnpm opencv:fetch\n` +
      `  - Download manually to ${TARGET.replace(REPO_ROOT + '/', '')}`,
  )
}

if (!FORCE && existsSync(TARGET) && statSync(TARGET).size > MIN_SIZE) {
  const mb = (statSync(TARGET).size / 1024 / 1024).toFixed(2)
  console.log(`✓ OpenCV.js already present at ${TARGET.replace(REPO_ROOT + '/', '')} (${mb} MB)`)
  process.exit(0)
}

const buf = await download()
await mkdir(dirname(TARGET), { recursive: true })
await writeFile(TARGET, buf)
console.log(
  `✓ Wrote ${TARGET.replace(REPO_ROOT + '/', '')} (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB)`,
)
