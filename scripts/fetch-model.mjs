#!/usr/bin/env node
/**
 * Pull a MODNet ONNX variant into public/_models/.
 *
 * Pixfit ships two variants (see src/features/segmentation/runtime-config.ts):
 *   - modnet-fp16 (~13 MB) — recommended default, keeps full alpha dynamic range
 *   - modnet-int8 (~6.6 MB) — quantized fallback for tight-bandwidth users
 *
 * Both upstream files live in `Xenova/modnet` (Apache-2.0). Variants are
 * downloaded from ModelScope first (China-friendly mirror, same etag),
 * Hugging Face second. Files are not committed to git — CI / contributors
 * run `pnpm models:fetch` once and cache locally.
 *
 * Verification: file size sanity check plus a SHA-384 digest that you
 * paste back into MODEL_VARIANTS[<id>].sha384 in runtime-config.ts.
 *
 * Usage:
 *   pnpm models:fetch                        # fp16 (default)
 *   pnpm models:fetch --variant int8         # legacy INT8 fallback
 *   pnpm models:fetch --variant fp16 --force # re-download
 *   pnpm models:fetch --print                # only compute & print the SHA
 *   pnpm models:fetch --from-file ./local.onnx --variant fp16
 *
 * Override hosts:
 *   MODEL_URL=...        — bypass registry, pull from this URL
 *   HF_ENDPOINT=...      — alternative HF mirror (e.g. hf-mirror.com)
 *   HTTPS_PROXY=...      — proxy for restricted networks
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const MAX_ATTEMPTS = 3

/**
 * Registry mirror of src/features/segmentation/runtime-config.ts. Kept
 * in sync by convention — the SHA in the runtime config is what gates
 * production; this script just helps you compute / verify it.
 */
const VARIANTS = {
  fp16: {
    path: 'modnet.fp16.onnx',
    minSize: 12 * 1024 * 1024, // ~13 MB; reject anything < 12
    sources: [
      'https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_fp16.onnx',
      'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_fp16.onnx',
    ],
  },
  int8: {
    path: 'modnet.q.onnx',
    minSize: 6 * 1024 * 1024, // ~6.63 MB
    sources: [
      'https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_quantized.onnx',
      'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx',
    ],
  },
}

const rawArgs = process.argv.slice(2)
const args = new Set(rawArgs)
const FORCE = args.has('--force')
const PRINT_ONLY = args.has('--print')

const variantIdx = rawArgs.indexOf('--variant')
const VARIANT_ID = variantIdx >= 0 ? rawArgs[variantIdx + 1] : 'fp16'
const VARIANT = VARIANTS[VARIANT_ID]
if (!VARIANT) {
  console.error(
    `Unknown --variant "${VARIANT_ID}". Valid: ${Object.keys(VARIANTS).join(', ')}.`,
  )
  process.exit(2)
}

const SOURCES = process.env.MODEL_URL
  ? [process.env.MODEL_URL]
  : VARIANT.sources.map((url) =>
      url.startsWith('https://huggingface.co/') && process.env.HF_ENDPOINT
        ? url.replace('https://huggingface.co', process.env.HF_ENDPOINT.replace(/\/$/, ''))
        : url,
    )

const TARGET = resolve(REPO_ROOT, `public/_models/${VARIANT.path}`)
const MIN_SIZE = VARIANT.minSize

const fromFileIdx = rawArgs.indexOf('--from-file')
const FROM_FILE = fromFileIdx >= 0 ? rawArgs[fromFileIdx + 1] : null

function sha384Base64(buf) {
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
      `  1. HTTPS_PROXY=http://127.0.0.1:7890 pnpm models:fetch --variant ${VARIANT_ID}\n` +
      `  2. Download manually, then: pnpm models:fetch --variant ${VARIANT_ID} --from-file <path>\n` +
      `  3. MODEL_URL=https://your-cdn/${VARIANT.path} pnpm models:fetch --variant ${VARIANT_ID}\n` +
      `Last error: ${lastErr?.message}`,
  )
}

console.log(`→ Variant: ${VARIANT_ID} (${VARIANT.path})`)

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

const sri = sha384Base64(buf)
console.log(`✓ SHA-384: ${sri}`)
console.log(`  size:    ${buf.byteLength} bytes (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB)`)
console.log(
  `\nWire this SRI into src/features/segmentation/runtime-config.ts:\n` +
    `  MODEL_VARIANTS['modnet-${VARIANT_ID}'].sha384 = '${sri}'\n`,
)
