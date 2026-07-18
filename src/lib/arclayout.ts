const FULLWIDTH_PX = 17
const HALFWIDTH_PX = 9
const BOX_PAD = 10
const BOX_GAP = 14
const ARC_BASE = 22
const ARC_STEP = 14
const ARC_MAX = 130

export function textWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ch.codePointAt(0)! > 0xff ? FULLWIDTH_PX : HALFWIDTH_PX
  return w
}

export interface ArcBox {
  x: number
  width: number
  cx: number
}

export interface ArcSpec {
  dep: number
  head: number
  x1: number
  x2: number
  /** px the arc rises above the box top line */
  top: number
}

export interface ArcLayout {
  boxes: ArcBox[]
  arcs: ArcSpec[]
  width: number
  arcAreaHeight: number
}

/**
 * Sasara guarantees rightward, non-crossing dependencies, so span-proportional
 * heights can never make two arcs cross each other.
 */
export function layoutArcs(surfaces: string[], heads: (number | null)[]): ArcLayout {
  const boxes: ArcBox[] = []
  let x = 0
  for (const s of surfaces) {
    const width = textWidth(s) + 2 * BOX_PAD
    boxes.push({ x, width, cx: x + width / 2 })
    x += width + BOX_GAP
  }
  const arcs: ArcSpec[] = []
  let maxTop = 0
  heads.forEach((head, dep) => {
    if (head === null) return
    const top = Math.min(ARC_BASE + ARC_STEP * (head - dep - 1), ARC_MAX)
    maxTop = Math.max(maxTop, top)
    arcs.push({ dep, head, x1: boxes[dep].cx, x2: boxes[head].cx, top })
  })
  return { boxes, arcs, width: Math.max(0, x - BOX_GAP), arcAreaHeight: maxTop + 12 }
}
