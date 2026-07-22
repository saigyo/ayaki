const FULLWIDTH_PX = 17
const HALFWIDTH_PX = 9
const BOX_PAD = 10
const BOX_GAP = 14
const ARC_BASE = 22
const ARC_STEP = 14

export function textWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ch.codePointAt(0)! > 0xff ? FULLWIDTH_PX : HALFWIDTH_PX
  return w
}

export interface DepPair {
  dep: number
  head: number
}

/** Nesting level per arc: 1 + the deepest level of any arc it encloses (B nests
 *  in A iff A.dep <= B.dep && B.head <= A.head). Shortest spans are processed
 *  first so nested levels are known before their enclosing arcs. */
export function nestingLevels(pairs: DepPair[]): number[] {
  const order = pairs
    .map((_, i) => i)
    .sort((a, b) => (pairs[a].head - pairs[a].dep) - (pairs[b].head - pairs[b].dep))
  const levels = new Array(pairs.length).fill(0)
  for (const i of order) {
    const a = pairs[i]
    let maxNestedLevel = 0
    for (let j = 0; j < pairs.length; j++) {
      if (j === i) continue
      const b = pairs[j]
      if (a.dep <= b.dep && b.head <= a.head) {
        maxNestedLevel = Math.max(maxNestedLevel, levels[j])
      }
    }
    levels[i] = 1 + maxNestedLevel
  }
  return levels
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
 * Sasara guarantees rightward, non-crossing dependencies. Arc height is based on
 * nesting level (displaCy style) rather than span: an arc's level is 1 + the
 * deepest level of any arc it encloses, so an enclosing arc is always strictly
 * higher than every arc it contains. Because heights only depend on nesting
 * depth, non-crossing input can never render crossing arcs, and there is no
 * need to cap the height — it is naturally bounded by how deeply arcs nest.
 */
export function layoutArcs(
  surfaces: string[],
  heads: (number | null)[],
  arcBase = ARC_BASE,
  minWidths?: number[],
  arcStep = ARC_STEP,
): ArcLayout {
  const boxes: ArcBox[] = []
  let x = 0
  surfaces.forEach((s, i) => {
    const width = Math.max(textWidth(s) + 2 * BOX_PAD, minWidths?.[i] ?? 0)
    boxes.push({ x, width, cx: x + width / 2 })
    x += width + BOX_GAP
  })
  const pairs: DepPair[] = []
  heads.forEach((head, dep) => {
    if (head === null) return
    pairs.push({ dep, head })
  })

  const levels = nestingLevels(pairs)

  const arcs: ArcSpec[] = []
  let maxTop = 0
  pairs.forEach(({ dep, head }, i) => {
    const top = arcBase + arcStep * (levels[i] - 1)
    maxTop = Math.max(maxTop, top)
    arcs.push({ dep, head, x1: boxes[dep].cx, x2: boxes[head].cx, top })
  })
  return { boxes, arcs, width: Math.max(0, x - BOX_GAP), arcAreaHeight: maxTop + 12 }
}
