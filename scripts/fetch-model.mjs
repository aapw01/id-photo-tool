#!/usr/bin/env node
/**
 * Pull the MODNet INT8 ONNX model into public/_models/.
 *
 * Upstream:   https://huggingface.co/Xenova/modnet  (Apache-2.0)
 * Local path: public/_models/modnet.q.onnx (~6.63 MB)
 *
 * The model is not committed to git. CI and contributors run
 * `pnpm models:fetch` once; the file is cached under public/ thereafter.
 *
 * Verification: file size sanity check (must look like a model, not an
 * HTML error page) plus a SHA-384 digest that is wired into the runtime
 * integrity check (see src/features/segmentation/integrity.ts).
 *
 * Usage:
 *   pnpm models:fetch          # download if missing
 *   pnpm models:fetch --force  # re-download and overwrite
 *   pnpm models:fetch --print  # don't write, just compute & print the SHA
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')

// Source list, tried in order. ModelScope is first because it mirrors the
// exact same Xenova/modnet repo, returns 200 directly (no xethub redirect),
// and is fast / unrestricted from mainland China. Hugging Face is kept as a
// fallback for environments where ModelScope is unreachable.
//
// Override with MODEL_URL=<your-cdn>/modnet.q.onnx for self-hosted copies.
const SOURCES = process.env.MODEL_URL
  ? [process.env.MODEL_URL]
  : [
      'https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_quantized.onnx',
      // HF_ENDPOINT lets users override the host (e.g. https://hf-mirror.com).
      `${(process.env.HF_ENDPOINT ?? 'https://huggingface.co').replace(/\/$/, '')}/Xenova/modnet/resolve/main/onnx/model_quantized.onnx`,
    ]

const TARGET = resolve(REPO_ROOT, 'public/_models/modnet.q.onnx')
const MIN_SIZE = 6 * 1024 * 1024 // 6 MB — model_quantized.onnx is ~6.63 MB
const MAX_ATTEMPTS = 3
const rawArgs = process.argv.slice(2)
const args = new Set(rawArgs)
const FORCE = args.has('--force')
const PRINT_ONLY = args.has('--print')

// `--from-file <path>` skips the network entirely and copies a local file in.
// Useful when the runner cannot reach huggingface.co (e.g. cas-bridge.xethub
// blocked, GFW, no VPN).
const fromFileIdx = rawArgs.indexOf('--from-file')
const FROM_FILE = fromFileIdx >= 0 ? rawArgs[fromFileIdx + 1] : null

async function sha384Base64(buf) {
  const digest = createHash('sha384').update(buf).digest('base64')
  return `sha384-${digest}`
}

async function readExisting() {
  if (!existsSync(TARGET)) return null
  return await readFile(TARGET)
}

async function downloadViaFetch(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < MIN_SIZE) {
    throw new Error(`Payload too small (${buf.byteLength} bytes); got HTML?`)
  }
  return buf
}

/**
 * curl fallback for environments where Node's fetch chokes on multi-hop
 * redirects (e.g. Node 26 + HF xethub TLS).
 */
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
        console.log(`✓ Downloaded via ${transport} (source #${SOURCES.indexOf(url) + 1})`)
        return buf
      } catch (err) {
        lastErr = err
        console.warn(`  attempt ${attempt}/${MAX_ATTEMPTS} (${transport}) failed: ${err.message}`)
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }
    }
    console.warn(`  giving up on this source, trying next...`)
  }
  throw new Error(
    `All ${SOURCES.length} sources failed.\n` +
      `Try one of:\n` +
      `  1. HTTPS_PROXY=http://127.0.0.1:7890 pnpm models:fetch\n` +
      `  2. Download manually, then: pnpm models:fetch --from-file <path>\n` +
      `  3. MODEL_URL=https://your-cdn/modnet.q.onnx pnpm models:fetch\n` +
      `Last error: ${lastErr?.message}`,
  )
}

let buf
if (FROM_FILE) {
  const abs = resolve(process.cwd(), FROM_FILE)
  console.log(`→ Importing local file ${abs}`)
  buf = await readFile(abs)
  if (buf.byteLength < MIN_SIZE) {
    throw new Error(`File too small (${buf.byteLength} bytes); not a real ONNX model?`)
  }
  await mkdir(dirname(TARGET), { recursive: true })
  await writeFile(TARGET, buf)
  console.log(`✓ Copied to ${TARGET.replace(REPO_ROOT + '/', '')}`)
} else if (PRINT_ONLY && existsSync(TARGET)) {
  buf = await readFile(TARGET)
} else if (FORCE || !existsSync(TARGET)) {
  buf = await download()
  await mkdir(dirname(TARGET), { recursive: true })
  await writeFile(TARGET, buf)
  console.log(`✓ Wrote ${TARGET} (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB)`)
} else {
  console.log(`✓ Model already present at ${TARGET.replace(REPO_ROOT + '/', '')}`)
  buf = (await readExisting()) ?? (await download())
}

const sri = await sha384Base64(buf)
console.log(`✓ SHA-384: ${sri}`)
console.log(`  size:    ${buf.byteLength} bytes (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB)`)
console.log(
  `\nWire this SRI into src/features/segmentation/integrity.ts:\n  export const MODEL_SHA384 = '${sri}'\n`,
)
