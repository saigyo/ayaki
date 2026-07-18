import { describe, expect, it } from 'vitest'
import { layoutArcs, textWidth } from '../../src/lib/arclayout'

describe('textWidth', () => {
  it('counts fullwidth wider than halfwidth', () => {
    expect(textWidth('猫')).toBe(17)
    expect(textWidth('a')).toBe(9)
    expect(textWidth('猫a')).toBe(26)
  })
})

describe('layoutArcs', () => {
  const l = layoutArcs(['猫が', '魚を', '食べた。'], [2, 2, null])

  it('lays boxes left to right without overlap', () => {
    expect(l.boxes).toHaveLength(3)
    for (let i = 1; i < l.boxes.length; i++) {
      expect(l.boxes[i].x).toBeGreaterThan(l.boxes[i - 1].x + l.boxes[i - 1].width)
    }
    expect(l.width).toBeGreaterThan(l.boxes[2].x)
  })
  it('creates one arc per non-root bunsetsu, endpoints at box centers', () => {
    expect(l.arcs).toHaveLength(2)
    const arc0 = l.arcs.find((a) => a.dep === 0)!
    expect(arc0.head).toBe(2)
    expect(arc0.x1).toBe(l.boxes[0].cx)
    expect(arc0.x2).toBe(l.boxes[2].cx)
  })
  it('arcs with longer spans rise higher, and arcAreaHeight covers the tallest', () => {
    const span2 = l.arcs.find((a) => a.dep === 0)!
    const span1 = l.arcs.find((a) => a.dep === 1)!
    expect(span2.top).toBeGreaterThan(span1.top)
    expect(l.arcAreaHeight).toBeGreaterThan(span2.top)
  })
  it('caps arc height for very long spans', () => {
    const long = layoutArcs(Array.from({ length: 15 }, (_, i) => `語${i}`), [...Array.from({ length: 14 }, () => 14), null])
    expect(Math.max(...long.arcs.map((a) => a.top))).toBeLessThanOrEqual(130)
  })
})
