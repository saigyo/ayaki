import { describe, expect, it } from 'vitest'
import { subtreeSpan } from '../../src/lib/extent'

describe('subtreeSpan', () => {
  // 昨日、私は友達と新しい映画を見に行きました。
  const heads: (number | null)[] = [6, 6, 6, 4, 5, 6, null]

  it('leaf → itself', () => {
    expect(subtreeSpan(heads, 3)).toEqual({ from: 3, to: 3 })
  })
  it('first bunsetsu leaf', () => {
    expect(subtreeSpan(heads, 0)).toEqual({ from: 0, to: 0 })
  })
  it('intermediate node carries its dependents', () => {
    expect(subtreeSpan(heads, 4)).toEqual({ from: 3, to: 4 })
  })
  it('clause head spans its whole chain', () => {
    expect(subtreeSpan(heads, 5)).toEqual({ from: 3, to: 5 })
  })
  it('root spans the whole sentence', () => {
    expect(subtreeSpan(heads, 6)).toEqual({ from: 0, to: 6 })
  })
  it('branching subtree is contiguous', () => {
    // 0→2, 1→2, 2→3, root 3
    expect(subtreeSpan([2, 2, 3, null], 2)).toEqual({ from: 0, to: 2 })
  })
})
