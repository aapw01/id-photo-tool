import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetOrtCache,
  __setOrtForTesting,
  createOrtSession,
  hasWebGPU,
} from '@/features/segmentation/ort-session'

interface MockOptions {
  /** If set, the n-th call to InferenceSession.create rejects. */
  failOn?: number[]
  outputData?: Float32Array
}

function makeOrtMock(opts: MockOptions = {}) {
  const failOn = new Set(opts.failOn ?? [])
  const createCalls: Array<{ providers: unknown }> = []

  const InferenceSession = {
    create: vi.fn(async (_buf: ArrayBuffer, options: Record<string, unknown>) => {
      createCalls.push({ providers: options.executionProviders })
      if (failOn.has(createCalls.length)) {
        throw new Error(`mock-failure-${createCalls.length}`)
      }
      return {
        inputNames: ['input'],
        outputNames: ['output'],
        run: vi.fn(async () => ({
          output: { data: opts.outputData ?? new Float32Array(8 * 8) },
        })),
      }
    }),
  }

  const ortMock = {
    Tensor: class {
      constructor(
        public type: string,
        public data: Float32Array,
        public dims: readonly number[],
      ) {}
    } as unknown as new (type: 'float32', data: Float32Array, dims: readonly number[]) => unknown,
    InferenceSession,
    env: { wasm: {} },
  }

  return { ortMock, createCalls, InferenceSession }
}

type GpuStub = { requestAdapter: () => Promise<unknown> } | undefined

function stubNavigatorGpu(gpu: GpuStub) {
  const nav = (globalThis as { navigator?: unknown }).navigator as
    | (Navigator & { gpu?: unknown })
    | undefined
  if (nav) {
    nav.gpu = gpu
  } else {
    ;(globalThis as { navigator: { gpu?: unknown } }).navigator = { gpu }
  }
}

afterEach(() => {
  __resetOrtCache()
  stubNavigatorGpu(undefined)
})

describe('hasWebGPU', () => {
  it('returns false when navigator.gpu is missing', async () => {
    expect(await hasWebGPU()).toBe(false)
  })

  it('returns true when an adapter is returned', async () => {
    stubNavigatorGpu({ requestAdapter: async () => ({}) })
    expect(await hasWebGPU()).toBe(true)
  })

  it('returns false when requestAdapter rejects', async () => {
    stubNavigatorGpu({
      requestAdapter: async () => {
        throw new Error('hw fault')
      },
    })
    expect(await hasWebGPU()).toBe(false)
  })

  it('returns false when no adapter is returned', async () => {
    stubNavigatorGpu({ requestAdapter: async () => null })
    expect(await hasWebGPU()).toBe(false)
  })
})

describe('createOrtSession', () => {
  it('initialises with WebGPU when forced and reports the backend tag', async () => {
    const { ortMock, createCalls } = makeOrtMock()
    __setOrtForTesting(ortMock)
    const session = await createOrtSession(new ArrayBuffer(8), { forceBackend: 'webgpu' })
    expect(session.backend).toBe('webgpu')
    expect(createCalls).toHaveLength(1)
    expect((createCalls[0]!.providers as string[])[0]).toBe('webgpu')
  })

  it('falls back from WebGPU to WASM when the GPU session-create keeps failing', async () => {
    const { ortMock, createCalls } = makeOrtMock({ failOn: [1, 2] })
    __setOrtForTesting(ortMock)
    const session = await createOrtSession(new ArrayBuffer(8), { forceBackend: 'webgpu' })
    expect(session.backend).toBe('wasm')
    // 2 webgpu attempts + 1 wasm attempt
    expect(createCalls.length).toBe(3)
    expect((createCalls.at(-1)!.providers as string[])[0]).toBe('wasm')
  })

  it('propagates the error when both backends fail', async () => {
    const { ortMock } = makeOrtMock({ failOn: [1, 2, 3, 4] })
    __setOrtForTesting(ortMock)
    await expect(createOrtSession(new ArrayBuffer(8), { forceBackend: 'webgpu' })).rejects.toThrow(
      /mock-failure/,
    )
  })
})
