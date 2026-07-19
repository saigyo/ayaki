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
  it('enclosing arcs rise higher than nested arcs, and arcAreaHeight covers the tallest', () => {
    const span2 = l.arcs.find((a) => a.dep === 0)!
    const span1 = l.arcs.find((a) => a.dep === 1)!
    expect(span2.top).toBeGreaterThan(span1.top)
    expect(l.arcAreaHeight).toBeGreaterThan(span2.top)
  })
  it('gives equal heights to a chain of non-nesting arcs', () => {
    const chain = layoutArcs(['一', '二', '三', '四'], [1, 2, 3, null])
    expect(chain.arcs).toHaveLength(3)
    for (const arc of chain.arcs) {
      expect(arc.top).toBe(22)
    }
  })
  it('gives strictly increasing heights to a fan of nested arcs sharing a head', () => {
    const surfaces = Array.from({ length: 15 }, (_, i) => `語${i}`)
    const headsArr = [...Array.from({ length: 14 }, () => 14), null]
    const fan = layoutArcs(surfaces, headsArr)
    expect(fan.arcs).toHaveLength(14)
    const tops = fan.arcs
      .slice()
      .sort((a, b) => a.dep - b.dep)
      .map((a) => a.top)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i]).toBeLessThan(tops[i - 1])
    }
    expect(new Set(tops).size).toBe(tops.length)
    expect(Math.max(...tops)).toBe(22 + 14 * 13)
  })
  it('raises every arc and the area height by an arcBase delta, defaulting to today', () => {
    const surfaces = ['猫が', '魚を', '食べた。']
    const heads = [2, 2, null]
    const base = layoutArcs(surfaces, heads)
    const raised = layoutArcs(surfaces, heads, 30)
    raised.arcs.forEach((a, i) => expect(a.top).toBe(base.arcs[i].top + 8))
    expect(raised.arcAreaHeight).toBe(base.arcAreaHeight + 8)
    expect(layoutArcs(surfaces, heads)).toEqual(base)
  })
})
