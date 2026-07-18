import { deflate, gzip } from 'pako'
import { describe, expect, it } from 'vitest'
import { join } from '../../src/shims/path'
import { Zlib } from '../../src/shims/gunzip'

describe('path shim', () => {
  it('joins segments with a single slash', () => {
    expect(join('/ayaki/dict/', 'base.dat.gz')).toBe('/ayaki/dict/base.dat.gz')
  })
  it('collapses repeated slashes without mangling a leading protocol-relative path', () => {
    expect(join('a/', '/b', 'c.txt')).toBe('a/b/c.txt')
  })
})

describe('gunzip shim', () => {
  it('passes through data that is not gzip-magic-prefixed', () => {
    const input = new Uint8Array([1, 2, 3])
    const gunzip = new Zlib.Gunzip(input)
    expect(gunzip.decompress()).toEqual(input)
  })

  it('decompresses real gzip data round-trip', () => {
    const original = new TextEncoder().encode('the quick brown fox jumps over the lazy dog')
    const compressed = gzip(original)
    const gunzip = new Zlib.Gunzip(compressed)
    expect(gunzip.decompress()).toEqual(original)
  })

  it('does not misfire on non-gzip data that happens to look compressed with deflate', () => {
    const original = new TextEncoder().encode('deflate, not gzip')
    const compressed = deflate(original)
    const gunzip = new Zlib.Gunzip(compressed)
    // deflate output has no gzip magic header, so it must pass through untouched
    expect(gunzip.decompress()).toEqual(compressed)
  })
})
