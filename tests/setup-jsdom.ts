// Install a localStorage shim when jsdom doesn't provide one (or blocks access to it,
// e.g. opaque origins raising SecurityError on mere property access).
const needsShim = (() => {
  if (typeof window === 'undefined') return false
  try {
    return typeof window.localStorage === 'undefined'
  } catch {
    return true
  }
})()

if (needsShim) {
  const store: Record<string, string> = Object.create(null)
  const shim = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key])
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  } as Storage
  // defineProperty instead of assignment: window.localStorage is readonly in DOM
  // typings and may be an accessor jsdom refuses to assign through.
  Object.defineProperty(window, 'localStorage', { configurable: true, value: shim })
}
