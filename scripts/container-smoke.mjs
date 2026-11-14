#!/usr/bin/env node
/** Verify a running standalone image, including files Next does not copy by default. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const request = (path, options = {}) =>
  fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000), ...options })

let ready = false
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    if ((await request('/en')).status === 200) {
      ready = true
      break
    }
  } catch {
    // The container may still be starting.
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
}
assert.ok(ready, 'Container did not become ready')

let home = ''
for (const path of ['/en', '/zh-Hans', '/zh-Hans/studio', '/zh-Hans/quick-tools', '/en/scanner']) {
  const res = await request(path)
  assert.equal(res.status, 200, path)
  const html = await res.text()
  assert.ok(html.includes('Pixfit'), `${path}: missing page content`)
  if (path === '/en') home = html
}

const root = await request('/', {
  redirect: 'manual',
  headers: { 'Accept-Language': 'en' },
})
assert.ok([301, 302, 307, 308].includes(root.status), 'Language middleware redirect missing')
assert.equal(new URL(root.headers.get('location'), base).pathname, '/en')
assert.equal((await request('/en/sizes/not-a-real-spec')).status, 404)

const scripts = [...home.matchAll(/src="([^" ]+\.js(?:\?[^" ]*)?)"/g)]
  .map((match) => match[1])
  .filter((path) => path.startsWith('/_next/static/'))
assert.ok(scripts.length, 'No Next.js static scripts in the rendered page')
const css = [...home.matchAll(/href="([^" ]+\.css(?:\?[^" ]*)?)"/g)]
  .map((match) => match[1])
  .filter((path) => path.startsWith('/_next/static/'))
assert.ok(css.length, 'No CSS in the rendered page')
for (const path of [...scripts, ...css, '/favicon.ico', '/icon.png', '/apple-icon.png']) {
  const res = await request(path)
  assert.equal(res.status, 200, path)
  assert.ok((await res.arrayBuffer()).byteLength > 0, `${path}: empty asset`)
}

const registry = await readFile(
  new URL('../src/features/segmentation/runtime-config.ts', import.meta.url),
  'utf8',
)
const expected = registry.match(/'modnet-fp16':\s*\{[^}]*sha384:\s*'([^']+)'/s)?.[1]
assert.ok(expected, 'Missing FP16 integrity hash in the model registry')
const model = await request('/_models/modnet.fp16.onnx')
assert.equal(model.status, 200, 'Model is not served')
const digest = createHash('sha384')
  .update(Buffer.from(await model.arrayBuffer()))
  .digest('base64')
assert.equal(`sha384-${digest}`, expected, 'Packaged model integrity mismatch')
console.log(
  'Container smoke checks passed: pages, locale redirect, 404, JS/CSS/icons and AI model integrity.',
)
