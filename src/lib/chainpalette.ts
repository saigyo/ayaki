export type ChainColor = 'amber' | 'green' | 'violet' | 'none'

export const CHAIN_COLORS: ChainColor[] = ['amber', 'green', 'violet', 'none']

export const CHAIN_PALETTE: Record<Exclude<ChainColor, 'none'>, { line: string; soft: string }> = {
  amber: { line: '#b07a2a', soft: '#f7ead3' },
  green: { line: '#2e7d6e', soft: '#e2f2ec' },
  violet: { line: '#7b5ea5', soft: '#ece5f6' },
}

export interface ChainSets {
  /** deps whose outgoing connector lies on the chain beyond the immediate link */
  links: Set<number>
  /** boxes strictly beyond the immediate head, root included */
  boxes: Set<number>
}

/**
 * Walk head pointers from the selected bunsetsu's head up to the root. The
 * immediate link and head box keep the existing `.hl` treatment, so the chain
 * sets start one step further out: links from the immediate head onward,
 * boxes from the head's head onward. The visited guard is defense against
 * malformed input only — sasara's parses are acyclic.
 */
export function chainFrom(heads: (number | null)[], selected: number): ChainSets {
  const links = new Set<number>()
  const boxes = new Set<number>()
  const visited = new Set<number>([selected])
  let cur = heads[selected]
  while (cur !== null && cur !== undefined && !visited.has(cur)) {
    visited.add(cur)
    const next = heads[cur]
    if (next === null || next === undefined) break
    // malformed cycle pointing back into the walked path: stop before a
    // visited index (possibly the selected bunsetsu itself) lands in `boxes`
    if (visited.has(next)) break
    links.add(cur)
    boxes.add(next)
    cur = next
  }
  return { links, boxes }
}
