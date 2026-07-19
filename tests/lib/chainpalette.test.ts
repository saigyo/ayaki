import { describe, expect, it } from 'vitest'
import { CHAIN_COLORS, CHAIN_PALETTE, chainFrom } from '../../src/lib/chainpalette'

describe('chainFrom', () => {
  const heads = [1, 2, 3, null]
  it('collects links and boxes beyond the immediate head', () => {
    const { links, boxes } = chainFrom(heads, 0)
    expect([...links].sort()).toEqual([1, 2])
    expect([...boxes].sort()).toEqual([2, 3])
  })
  it('is empty when the head is the root or the selected bunsetsu is the root', () => {
    expect(chainFrom(heads, 2).links.size).toBe(0)
    expect(chainFrom(heads, 2).boxes.size).toBe(0)
    expect(chainFrom(heads, 3).links.size).toBe(0)
  })
  it('terminates on malformed cyclic heads without chain-classing walked indices', () => {
    const { links, boxes } = chainFrom([1, 0], 0)
    expect(links.size).toBeLessThanOrEqual(2)
    // the selected bunsetsu and its immediate head must never land in the
    // chain sets, even when a cycle points back at them
    expect(boxes.has(0)).toBe(false)
    expect(boxes.has(1)).toBe(false)
  })
})

describe('CHAIN_PALETTE', () => {
  it('covers every non-none color with line and soft values', () => {
    for (const c of CHAIN_COLORS) {
      if (c === 'none') continue
      const entry = CHAIN_PALETTE[c]
      expect(entry.line).toMatch(/^#[0-9a-f]{6}$/)
      expect(entry.soft).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
