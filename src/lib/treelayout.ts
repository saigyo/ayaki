const LEVEL_H = 70

export interface TreeNodePos {
  index: number
  /** center x */
  x: number
  y: number
}

export interface TreeLayout {
  nodes: TreeNodePos[]
  /** from = head, to = dependent */
  edges: { from: number; to: number }[]
  width: number
  height: number
}

/** Simple tidy tree: each subtree gets max(own width, sum of child subtrees). */
export function layoutTree(widths: number[], heads: (number | null)[], gap = 20): TreeLayout {
  const n = widths.length
  if (n === 0) return { nodes: [], edges: [], width: 0, height: 0 }

  const children: number[][] = Array.from({ length: n }, () => [])
  let root = n - 1
  heads.forEach((h, i) => {
    if (h === null) root = i
    else children[h].push(i) // pushed in ascending index order = sentence order
  })

  const subW = new Array<number>(n).fill(0)
  const measure = (i: number): number => {
    const kids = children[i]
    const kidsW = kids.reduce((acc, k) => acc + measure(k), 0) + gap * Math.max(0, kids.length - 1)
    subW[i] = Math.max(widths[i], kidsW)
    return subW[i]
  }
  measure(root)

  const nodes: TreeNodePos[] = []
  let maxDepth = 0
  const place = (i: number, left: number, depth: number) => {
    maxDepth = Math.max(maxDepth, depth)
    nodes.push({ index: i, x: left + subW[i] / 2, y: depth * LEVEL_H })
    const kids = children[i]
    const kidsW = kids.reduce((acc, k) => acc + subW[k], 0) + gap * Math.max(0, kids.length - 1)
    let cursor = left + (subW[i] - kidsW) / 2
    for (const k of kids) {
      place(k, cursor, depth + 1)
      cursor += subW[k] + gap
    }
  }
  place(root, 0, 0)

  const edges = heads.flatMap((h, i) => (h === null ? [] : [{ from: h, to: i }]))
  return { nodes, edges, width: subW[root], height: maxDepth * LEVEL_H }
}
