import { describe, expect, it } from 'vitest'
import { morphemeRole, PART_PALETTE, PART_ROLES } from '../../src/lib/partroles'

describe('morphemeRole', () => {
  it.each([
    ['動詞・自立', 'head'],
    ['名詞・一般', 'head'],
    ['名詞・代名詞', 'head'],
    ['形容詞・自立', 'head'],
    ['副詞・一般', 'head'],
    ['助動詞', 'aux'],
    ['助詞・終助詞', 'particle'],
    ['助詞・格助詞', 'particle'],
    ['記号・句点', 'symbol'],
    ['記号・読点', 'symbol'],
    ['接頭詞・名詞接続', 'affix'],
    ['名詞・接尾', 'affix'],
    ['動詞・接尾', 'affix'],
  ])('%s → %s', (posJa, role) => {
    expect(morphemeRole(posJa)).toBe(role)
  })
})

describe('palette', () => {
  it('covers every role, in legend order', () => {
    expect(PART_ROLES).toEqual(['head', 'aux', 'particle', 'affix', 'symbol'])
    for (const r of PART_ROLES) expect(PART_PALETTE[r]).toMatch(/^#[0-9a-f]{6}$/)
  })
})
