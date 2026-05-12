import '@testing-library/jest-dom/vitest'

// Node 26+ gates Web Storage behind --localstorage-file. Tests rely on
// the synchronous API for cache logic, so install an in-memory shim
// when the runtime does not expose one.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private map = new Map<string, string>()
    get length(): number {
      return this.map.size
    }
    clear(): void {
      this.map.clear()
    }
    getItem(key: string): string | null {
      return this.map.has(key) ? this.map.get(key)! : null
    }
    key(index: number): string | null {
      return Array.from(this.map.keys())[index] ?? null
    }
    removeItem(key: string): void {
      this.map.delete(key)
    }
    setItem(key: string, value: string): void {
      this.map.set(key, String(value))
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  })
}
