import { describe, expect, it } from 'vitest'
import { layoutStairs } from '../../src/lib/stairlayout'
import { textWidth } from '../../src/lib/arclayout'

// sentenceFixture shape: 猫が(→2) 魚を(→2) 食べた。(root)
const surfaces = ['猫が', '魚を', '食べた。']
const heads: (number | null)[] = [2, 2, null]
const opts = { rowHeight: 46, boxCenterOffset: 17 }
const maxW = textWidth('食べた。') + 20

describe('layoutStairs', () => {
  it('right-aligns boxes to a uniform right-edge stair', () => {
    const l = layoutStairs(surfaces, heads, opts)
    l.boxes.forEach((b, i) => {
      expect(b.x + b.width).toBe(maxW + i * 24)
      expect(b.x).toBe(maxW + i * 24 - b.width)
    })
    expect(l.boxes.map((b) => b.y)).toEqual([0, 46, 92])
    expect(l.height).toBe(3 * 46)
  })
  it('pushes shorter surfaces further right than the old left-aligned baseline', () => {
    const l = layoutStairs(surfaces, heads, opts)
    // Rows 0 and 1 (猫が, 魚を) are narrower than the widest box (食べた。), so
    // right-alignment places their left edge to the right of the old
    // left-aligned x = i * STEP baseline. Row 2 is the widest box, so its
    // left edge coincides with the baseline (width === maxW).
    expect(l.boxes[0].x).toBeGreaterThan(0 * 24)
    expect(l.boxes[1].x).toBeGreaterThan(1 * 24)
    expect(l.boxes[2].x).toBe(2 * 24)
  })
  it('gives both dependents of the same head the same shared rail', () => {
    const l = layoutStairs(surfaces, heads, opts)
    const byDep = Object.fromEntries(l.connectors.map((c) => [c.dep, c]))
    const expectedRailX = maxW + 2 * 24 + 16
    expect(byDep[0].railX).toBe(expectedRailX)
    expect(byDep[1].railX).toBe(expectedRailX)
    expect(l.width).toBe(expectedRailX)
  })
  it('exposes each connector as dependent-edge and head-edge coordinates via the shared rail', () => {
    const l = layoutStairs(surfaces, heads, opts)
    const c = l.connectors.find((x) => x.dep === 1)!
    const dep = l.boxes[1]
    const head = l.boxes[2]
    expect(c).toEqual({ dep: 1, head: 2, railX: c.railX, x1: dep.x + dep.width, y1: dep.y + 17, x2: head.x + head.width, y2: head.y + 17 })
  })
  it('reflects the row height option (furigana headroom)', () => {
    const tall = layoutStairs(surfaces, heads, { rowHeight: 62, boxCenterOffset: 33 })
    expect(tall.boxes[2].y).toBe(124)
    expect(tall.connectors[0].y2).toBe(124 + 33)
  })
  it('handles a single bunsetsu without connectors', () => {
    const l = layoutStairs(['猫。'], [null], opts)
    expect(l.connectors).toEqual([])
    expect(l.boxes).toHaveLength(1)
    expect(l.width).toBe(l.boxes[0].width)
  })
  it('gives a dependency chain strictly increasing rails per head', () => {
    // 新しい(→1) 映画を(→2) 見に(→3) 行きました。(root) — a chain, each dep's head is
    // the next bunsetsu, so each head's own xRight (and therefore rail) grows.
    const chainSurfaces = ['新しい', '映画を', '見に', '行きました。']
    const chainHeads: (number | null)[] = [1, 2, 3, null]
    const l = layoutStairs(chainSurfaces, chainHeads, opts)
    const chainMaxW = Math.max(...chainSurfaces.map((s) => textWidth(s) + 20))
    const xRight = (i: number) => chainMaxW + i * 24
    const byDep = Object.fromEntries(l.connectors.map((c) => [c.dep, c]))
    expect(byDep[0].railX).toBe(xRight(1) + 16)
    expect(byDep[1].railX).toBe(xRight(2) + 16)
    expect(byDep[2].railX).toBe(xRight(3) + 16)
    expect(byDep[0].railX).toBeLessThan(byDep[1].railX)
    expect(byDep[1].railX).toBeLessThan(byDep[2].railX)
  })
  it('offsets each rail 16px right of its head column', () => {
    const layout = layoutStairs(['新しい', '映画を', '見に'], [1, 2, null], { rowHeight: 46, boxCenterOffset: 17 })
    const widths = ['新しい', '映画を', '見に'].map((s) => textWidth(s) + 20)
    const maxW = Math.max(...widths)
    for (const c of layout.connectors) expect(c.railX).toBe(maxW + c.head * 24 + 16)
  })
})
