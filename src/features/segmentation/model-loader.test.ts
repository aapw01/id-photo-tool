import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { IntegrityError } from '@/features/segmentation/integrity'
import { ModelNetworkError, loadModel } from '@/features/segmentation/model-loader'

const URL = '/test/model.onnx'

function makePayload(seed: number, length = 64): { buf: ArrayBuffer; sha384: string } {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = (seed + i) & 0xff
  const digest = createHash('sha384').update(bytes).digest('base64')
  return { buf: bytes.buffer, sha384: `sha384-${digest}` }
}

function streamingResponse(buf: ArrayBuffer, chunkSize = 16): Response {
  const bytes = new Uint8Array(buf)
  const total = bytes.byteLength
  let offset = 0
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= total) {
        controller.close()
        return
      }
      const end = Math.min(offset + chunkSize, total)
      controller.enqueue(bytes.slice(offset, end))
      offset = end
    },
  })
  return new Response(stream, { headers: { 'content-length': String(total) } })
}

function makeCacheStorage(): {
  caches: CacheStorage
  seed(url: string, buf: ArrayBuffer): Promise<void>
  size(): Promise<number>
} {
  const store = new Map<string, Response>()
  const cache = {
    match: async (req: RequestInfo | URL) => {
      const key = typeof req === 'string' ? req : req.toString()
      return store.get(key)?.clone() ?? undefined
    },
    put: async (req: RequestInfo | URL, res: Response) => {
      const key = typeof req === 'string' ? req : req.toString()
      store.set(key, res.clone())
    },
  } as unknown as Cache
  const caches = {
    open: async () => cache,
  } as unknown as CacheStorage
  return {
    caches,
    seed: async (url, buf) => {
      store.set(url, new Response(buf.slice(0)))
    },
    size: async () => store.size,
  }
}

describe('loadModel', () => {
  it('reuses the existing same-origin cache after switching to the CDN', async () => {
    const { buf, sha384 } = makePayload(5)
    const { caches, seed } = makeCacheStorage()
    await seed(URL, buf)
    const fetch = vi.fn()

    const out = await loadModel({
      url: 'https://www.modelscope.cn/test/model.onnx',
      fallbackUrl: URL,
      expectedSha384: sha384,
      caches,
      fetch,
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses the verified local cache if the external cache is corrupted', async () => {
    const { buf, sha384 } = makePayload(5)
    const { caches, seed } = makeCacheStorage()
    const primary = 'https://www.modelscope.cn/test/model.onnx'
    await seed(primary, makePayload(7).buf)
    await seed(URL, buf)
    const fetch = vi.fn()

    const out = await loadModel({
      url: primary,
      fallbackUrl: URL,
      expectedSha384: sha384,
      caches,
      fetch,
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('falls back immediately to the same-origin copy if the CDN is unavailable', async () => {
    const { buf, sha384 } = makePayload(6)
    const primary = 'https://www.modelscope.cn/test/model.onnx'
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (url === primary) throw new TypeError('CDN unavailable')
      return new Response(buf.slice(0))
    })

    const out = await loadModel({
      url: primary,
      fallbackUrl: URL,
      expectedSha384: sha384,
      caches: null,
      fetch: fetch as typeof globalThis.fetch,
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf))
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([primary, URL])
  })

  it('only accepts a verified same-origin copy if the CDN returns altered bytes', async () => {
    const { buf, sha384 } = makePayload(9)
    const altered = makePayload(10).buf
    const primary = 'https://www.modelscope.cn/test/model.onnx'
    const fetch = vi.fn(
      async (url: RequestInfo | URL) => new Response((url === primary ? altered : buf).slice(0)),
    )

    const out = await loadModel({
      url: primary,
      fallbackUrl: URL,
      expectedSha384: sha384,
      caches: null,
      fetch: fetch as typeof globalThis.fetch,
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf))
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([primary, URL])
  })

  it('does not duplicate retries when the configured URL is already same-origin', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('offline')
    })

    await expect(
      loadModel({
        url: URL,
        fallbackUrl: URL,
        expectedSha384: 'sha384-anything',
        caches: null,
        fetch,
      }),
    ).rejects.toBeInstanceOf(ModelNetworkError)

    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('returns the buffer from cache without hitting the network', async () => {
    const { buf, sha384 } = makePayload(7)
    const { caches, seed } = makeCacheStorage()
    await seed(URL, buf)
    const fetch = vi.fn()
    const progress = vi.fn()

    const out = await loadModel({
      url: URL,
      expectedSha384: sha384,
      caches,
      fetch,
      onProgress: progress,
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf))
    expect(fetch).not.toHaveBeenCalled()
    expect(progress).toHaveBeenCalledWith('download', buf.byteLength, buf.byteLength)
  })

  it('falls through to fetch on cache miss and reports byte-level progress', async () => {
    const { buf, sha384 } = makePayload(11, 96)
    const { caches, size } = makeCacheStorage()
    const fetch = vi.fn(async () => streamingResponse(buf, 32))
    const progress = vi.fn()

    const out = await loadModel({
      url: URL,
      expectedSha384: sha384,
      caches,
      fetch,
      onProgress: progress,
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf))
    expect(fetch).toHaveBeenCalledTimes(1)
    // First call is the 0/total announcement, last call is total/total.
    expect(progress.mock.calls[0]).toEqual(['download', 0, 96])
    expect(progress.mock.calls.at(-1)).toEqual(['download', 96, 96])
    // And it was written back to the cache.
    expect(await size()).toBe(1)
  })

  it('rejects with IntegrityError on hash mismatch and does NOT retry', async () => {
    const { buf } = makePayload(1)
    const wrong = makePayload(2).sha384 // deliberately wrong
    const fetch = vi.fn(async () => new Response(buf.slice(0)))

    await expect(
      loadModel({
        url: URL,
        expectedSha384: wrong,
        caches: null,
        fetch,
      }),
    ).rejects.toBeInstanceOf(IntegrityError)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on transient network failures and recovers', async () => {
    const { buf, sha384 } = makePayload(3)
    let calls = 0
    const fetch = vi.fn(async () => {
      calls++
      if (calls < 3) throw new TypeError('connection reset')
      return new Response(buf.slice(0))
    })

    const out = await loadModel({
      url: URL,
      expectedSha384: sha384,
      caches: null,
      fetch,
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf))
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('throws ModelNetworkError once retries are exhausted', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('offline')
    })

    await expect(
      loadModel({
        url: URL,
        expectedSha384: 'sha384-anything',
        caches: null,
        fetch,
      }),
    ).rejects.toBeInstanceOf(ModelNetworkError)

    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('throws ModelNetworkError on non-2xx HTTP statuses', async () => {
    const fetch = vi.fn(async () => new Response('not found', { status: 404 }))

    await expect(
      loadModel({
        url: URL,
        expectedSha384: 'sha384-anything',
        caches: null,
        fetch,
      }),
    ).rejects.toBeInstanceOf(ModelNetworkError)
  })
})
