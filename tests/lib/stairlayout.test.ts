import { describe, expect, it } from 'vitest'
import { layoutStairs } from '../../src/lib/stairlayout'
import { textWidth } from '../../src/lib/arclayout'

// sentenceFixture shape: 猫が(→2) 魚を(→2) 食べた。(root)
const surfaces = ['猫が', '魚を', '食べた。']
const heads: (number | null)[] = [2, 2, null]
const opts = { rowHeight: 46, boxCenterOffset: 17 }

describe('layoutStairs', () => {
  it('places one row per bunsetsu with a uniform stair indent', () => {
    const l = layoutStairs(surfaces, heads, opts)
    expect(l.boxes.map((b) => b.x)).toEqual([0, 24, 48])
    expect(l.boxes.map((b) => b.y)).toEqual([0, 46, 92])
    expect(l.boxes[0].width).toBe(textWidth('猫が') + 20)
    expect(l.height).toBe(3 * 46)
  })
  it('assigns rails by nesting level: the enclosing arc gets the farther rail', () => {
    const l = layoutStairs(surfaces, heads, opts)
    // (魚を→食べた。) nests inside (猫が→食べた。): dep0's rail must be right of dep1's
    const byDep = Object.fromEntries(l.connectors.map((c) => [c.dep, c]))
    expect(byDep[0].railX).toBeGreaterThan(byDep[1].railX)
    // both rails clear the widest box's right edge
    const maxRight = Math.max(...l.boxes.map((b) => b.x + b.width))
    expect(byDep[1].railX).toBeGreaterThanOrEqual(maxRight + 16)
    expect(l.width).toBe(byDep[0].railX)
  })
  it('draws each connector from the dependent box edge via the rail into the head box edge', () => {
    const l = layoutStairs(surfaces, heads, opts)
    const c = l.connectors.find((x) => x.dep === 1)!
    const dep = l.boxes[1]
    const head = l.boxes[2]
    expect(c.d).toBe(
      `M ${dep.x + dep.width} ${dep.y + 17} H ${c.railX} V ${head.y + 17} H ${head.x + head.width}`,
    )
  })
  it('reflects the row height option (furigana headroom)', () => {
    const tall = layoutStairs(surfaces, heads, { rowHeight: 62, boxCenterOffset: 33 })
    expect(tall.boxes[2].y).toBe(124)
    expect(tall.connectors[0].d).toContain(` ${124 + 33} `)
  })
  it('handles a single bunsetsu without connectors', () => {
    const l = layoutStairs(['猫。'], [null], opts)
    expect(l.connectors).toEqual([])
    expect(l.boxes).toHaveLength(1)
    expect(l.width).toBe(l.boxes[0].width)
  })
})
