import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fresh module state per test: parser.ts caches a live parser promise at module scope, so we
// need vi.resetModules() + a dynamic import to observe init-failure behavior in isolation.
describe('parser init-failure retry', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not cache a failed init — a retry re-fetches instead of reusing the rejected promise', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const { parseText, parserReady } = await import('../../src/lib/parser')

    expect(parserReady()).toBe(false)

    await expect(parseText('x')).rejects.toThrow('network down')
    expect(parserReady()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // A cached failure would also reject here without calling fetch again — assert the call
    // count instead of just the rejection to prove the retry actually re-attempts init.
    await expect(parseText('x')).rejects.toThrow('network down')
    expect(parserReady()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
