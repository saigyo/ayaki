import { nestingLevels, textWidth } from './arclayout'

const BOX_PAD = 10
const STEP = 24
const RAIL_BASE = 16
const RAIL_STEP = 12

export interface StairBox {
  x: number
  y: number
  width: number
}

export interface StairConnector {
  dep: number
  head: number
  railX: number
  d: string
}

export interface StairLayout {
  boxes: StairBox[]
  connectors: StairConnector[]
  width: number
  height: number
}

export interface StairOptions {
  /** full row height incl. furigana headroom and inter-row gap */
  rowHeight: number
  /** y offset of the box's vertical center within its row */
  boxCenterOffset: number
}

/**
 * CaboCha-style stair layout: one row per bunsetsu in sentence order, each row
 * indented STEP px further right. Connectors run from the dependent box's right
 * edge to a vertical rail, down to the head's row, and back into the head box's
 * right edge. Rail columns are assigned by arc nesting level — the arc view's
 * height rule rotated 90° — so sasara's non-crossing input never renders
 * crossing connectors. Disjoint arcs may share a rail column; their vertical
 * segments occupy disjoint row ranges.
 */
export function layoutStairs(
  surfaces: string[],
  heads: (number | null)[],
  opts: StairOptions,
): StairLayout {
  const boxes: StairBox[] = surfaces.map((s, i) => ({
    x: i * STEP,
    y: i * opts.rowHeight,
    width: textWidth(s) + 2 * BOX_PAD,
  }))
  const pairs: { dep: number; head: number }[] = []
  heads.forEach((head, dep) => {
    if (head !== null) pairs.push({ dep, head })
  })
  const levels = nestingLevels(pairs)
  const maxRight = Math.max(0, ...boxes.map((b) => b.x + b.width))
  const connectors: StairConnector[] = pairs.map(({ dep, head }, i) => {
    const railX = maxRight + RAIL_BASE + RAIL_STEP * (levels[i] - 1)
    const y1 = boxes[dep].y + opts.boxCenterOffset
    const y2 = boxes[head].y + opts.boxCenterOffset
    return {
      dep,
      head,
      railX,
      d: `M ${boxes[dep].x + boxes[dep].width} ${y1} H ${railX} V ${y2} H ${boxes[head].x + boxes[head].width}`,
    }
  })
  const width = connectors.length ? Math.max(...connectors.map((c) => c.railX)) : maxRight
  return { boxes, connectors, width, height: surfaces.length * opts.rowHeight }
}
