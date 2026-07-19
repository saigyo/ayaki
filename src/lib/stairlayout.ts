import { textWidth } from './arclayout'

const BOX_PAD = 10
const STEP = 24
const RAIL_GAP = 16

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
 * CaboCha-style stair layout: one row per bunsetsu in sentence order. Boxes are
 * right-aligned to a uniform right-edge stair — `xRight(i) = maxBoxWidth + i *
 * STEP` — so left edges vary with surface length while right edges step evenly.
 * This mirrors CaboCha's own `write_tree` indent rule in `tree.cpp`,
 * `max_len - len(surface) + i * 2`, which is like the mirror image (indent
 * grows as the surface shortens) of the same right-edge stair.
 *
 * Each head owns exactly one rail, in its own column: `railX(head) =
 * xRight(head) + RAIL_GAP`. Every dependent of that head runs horizontally
 * from its right edge to the shared rail, down (or up) to the head's row, then
 * a short leftward stub into the head box's right edge — the `-D` column of
 * the terminal output. Because sasara's parses never cross, a head further
 * right always owns a further-right rail, so nested arcs naturally get nested
 * rails without needing a separate nesting-level computation (unlike the arcs
 * view, which still uses `nestingLevels` for arc height).
 */
export function layoutStairs(
  surfaces: string[],
  heads: (number | null)[],
  opts: StairOptions,
): StairLayout {
  const widths = surfaces.map((s) => textWidth(s) + 2 * BOX_PAD)
  const maxBoxWidth = Math.max(0, ...widths)
  const xRight = (i: number): number => maxBoxWidth + i * STEP
  const boxes: StairBox[] = surfaces.map((_, i) => {
    const width = widths[i]
    return {
      x: xRight(i) - width,
      y: i * opts.rowHeight,
      width,
    }
  })
  const pairs: { dep: number; head: number }[] = []
  heads.forEach((head, dep) => {
    if (head !== null) pairs.push({ dep, head })
  })
  const connectors: StairConnector[] = pairs.map(({ dep, head }) => {
    const railX = xRight(head) + RAIL_GAP
    const y1 = boxes[dep].y + opts.boxCenterOffset
    const y2 = boxes[head].y + opts.boxCenterOffset
    return {
      dep,
      head,
      railX,
      d: `M ${boxes[dep].x + boxes[dep].width} ${y1} H ${railX} V ${y2} H ${boxes[head].x + boxes[head].width}`,
    }
  })
  const width = connectors.length ? Math.max(...connectors.map((c) => c.railX)) : maxBoxWidth
  return { boxes, connectors, width, height: surfaces.length * opts.rowHeight }
}
