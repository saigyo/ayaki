import { describe, expect, it } from 'vitest'
import { loadParser } from 'sasara'
import { parseTextWith } from '../../src/lib/parser'

describe('sasara pipeline (Node, real dictionary)', () => {
  it('parses a two-sentence input into structured trees', async () => {
    const parser = await loadParser()
    const result = await parseTextWith(parser, '猫が魚を食べた。犬は走る。')
    expect(result).toHaveLength(2)
    for (const s of result) {
      expect(s.error).toBeNull()
      expect(s.bunsetsu.length).toBeGreaterThanOrEqual(2)
      expect(s.bunsetsu.map((b) => b.surface).join('')).toBe(s.text)
      const root = s.bunsetsu.at(-1)!
      expect(root.head).toBeNull()
      for (const b of s.bunsetsu.slice(0, -1)) {
        expect(b.head).toBeGreaterThan(b.index) // rightward dependencies
        expect(b.morphemes.length).toBeGreaterThan(0)
        expect(b.morphemes.every((m) => m.posJa.length > 0)).toBe(true)
      }
      // confidence plumbing works end to end
      expect(s.bunsetsu.some((b) => b.probability !== null && b.probability >= 0 && b.probability <= 1)).toBe(true)
    }
  }, 60_000)
})
