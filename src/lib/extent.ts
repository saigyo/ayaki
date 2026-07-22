/**
 * Contiguous index span of bunsetsu i's subtree.
 *
 * Japanese dependencies are strictly head-final (every head index > dependent
 * index) and projective (spans never cross), so a subtree is always the
 * contiguous range [leftmost transitive dependent, i]. Scanning left from i:
 * an index j belongs to the subtree iff its head lands at or before i — the
 * first j whose head escapes past i (or is the root) ends the span, and
 * projectivity guarantees nothing further left can re-enter it.
 */
export function subtreeSpan(heads: (number | null)[], i: number): { from: number; to: number } {
  let from = i
  for (let j = i - 1; j >= 0; j--) {
    const h = heads[j]
    if (h !== null && h <= i) from = j
    else break
  }
  return { from, to: i }
}
