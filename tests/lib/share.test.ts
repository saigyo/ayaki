import { describe, expect, it } from 'vitest'
import { buildShareUrl, parseShareParams } from '../../src/lib/share'

const BASE = 'https://example.test/ayaki/'

describe('buildShareUrl', () => {
  it('always carries text and view, nothing else by default', () => {
    const u = new URL(buildShareUrl(BASE, '猫が魚を食べた。', 'arcs', null, null))
    expect(u.origin + u.pathname).toBe(BASE)
    expect(u.searchParams.get('text')).toBe('猫が魚を食べた。')
    expect(u.searchParams.get('view')).toBe('arcs')
    expect(u.searchParams.get('s')).toBeNull()
    expect(u.searchParams.get('b')).toBeNull()
  })
  it('round-trips text containing separators and newlines', () => {
    const text = 'a&b=c+d?e\n二文目。'
    const parsed = parseShareParams(new URL(buildShareUrl(BASE, text, 'tree', null, null)).search)
    expect(parsed?.text).toBe(text)
    expect(parsed?.view).toBe('tree')
  })
  it('encodes a selection in sentence 0 as s=0&b=n', () => {
    const u = new URL(buildShareUrl(BASE, 'x', 'cabocha', 0, 4))
    expect(u.searchParams.get('s')).toBe('0')
    expect(u.searchParams.get('b')).toBe('4')
  })
  it('encodes an active later sentence without selection as s only', () => {
    const u = new URL(buildShareUrl(BASE, 'x', 'arcs', 2, null))
    expect(u.searchParams.get('s')).toBe('2')
    expect(u.searchParams.get('b')).toBeNull()
  })
})

describe('parseShareParams', () => {
  it('returns null without a text param or with blank text', () => {
    expect(parseShareParams('')).toBeNull()
    expect(parseShareParams('?view=tree')).toBeNull()
    expect(parseShareParams('?text=%20%20')).toBeNull()
  })
  it('nulls an unknown view and keeps the text', () => {
    const p = parseShareParams('?text=x&view=sideways')
    expect(p?.text).toBe('x')
    expect(p?.view).toBeNull()
  })
  it('rejects malformed indices', () => {
    expect(parseShareParams('?text=x&s=-1')?.sentence).toBeNull()
    expect(parseShareParams('?text=x&s=1.5')?.sentence).toBeNull()
    expect(parseShareParams('?text=x&b=x')?.bunsetsu).toBeNull()
  })
  it('defaults the sentence to 0 when only b is present', () => {
    const p = parseShareParams('?text=x&b=3')
    expect(p?.sentence).toBe(0)
    expect(p?.bunsetsu).toBe(3)
  })
})
