import { describe, expect, it } from 'vitest'
import { layoutTree } from '../../src/lib/treelayout'

describe('layoutTree', () => {
  // heads as sasara produces them: root last, everything points right
  const widths = [50, 50, 50, 60]
  const heads = [3, 3, 3, null]
  const l = layoutTree(widths, heads)
  const byIndex = new Map(l.nodes.map((n) => [n.index, n]))

  it('places the root at depth 0 and its dependents one level below', () => {
    expect(byIndex.get(3)!.y).toBe(0)
    for (const i of [0, 1, 2]) expect(byIndex.get(i)!.y).toBe(70)
  })
  it('keeps siblings in sentence order without overlap', () => {
    const xs = [0, 1, 2].map((i) => byIndex.get(i)!.x)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(50)
    expect(xs[2] - xs[1]).toBeGreaterThanOrEqual(50)
  })
  it('emits head→dependent edges', () => {
    expect(l.edges).toEqual([
      { from: 3, to: 0 },
      { from: 3, to: 1 },
      { from: 3, to: 2 },
    ])
  })
  it('handles chains (nested subtrees)', () => {
    // 新しい→映画を→見に→行く: 0→1, 1→2, 2→3
    const chain = layoutTree([50, 50, 50, 50], [1, 2, 3, null])
    const pos = new Map(chain.nodes.map((n) => [n.index, n]))
    expect(pos.get(3)!.y).toBe(0)
    expect(pos.get(2)!.y).toBe(70)
    expect(pos.get(1)!.y).toBe(140)
    expect(pos.get(0)!.y).toBe(210)
    expect(chain.height).toBeGreaterThanOrEqual(210)
  })
  it('handles a single bunsetsu and empty input', () => {
    const single = layoutTree([80], [null])
    expect(single.nodes).toEqual([{ index: 0, x: 40, y: 0 }])
    expect(layoutTree([], []).nodes).toEqual([])
  })
})
