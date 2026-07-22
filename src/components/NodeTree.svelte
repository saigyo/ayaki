<script lang="ts">
  import { textWidth } from '../lib/arclayout'
  import { layoutTree } from '../lib/treelayout'
  import { subtreeSpan } from '../lib/extent'
  import { confidenceLabel, isUncertain, LOW_CONFIDENCE } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'
  import { t } from '../lib/i18n.svelte'
  import { RELATION_TERM_KEYS } from '../lib/relations'
  import { CHAIN_PALETTE, chainFrom, type ChainColor } from '../lib/chainpalette'
  import type { RelationDisplay } from '../lib/settings'

  let {
    bunsetsu,
    showFurigana = false,
    showConfidence = false,
    confidenceThreshold = LOW_CONFIDENCE,
    selected = null,
    chainColor = 'none',
    relationDisplay = 'off',
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    showFurigana?: boolean
    showConfidence?: boolean
    confidenceThreshold?: number
    selected?: number | null
    chainColor?: ChainColor
    relationDisplay?: RelationDisplay
    onselect: (index: number) => void
  } = $props()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const BOX_PAD = 10
  const PAD_X = 4
  const FURI_H = 16
  const REL_H = 15

  const relH = $derived(relationDisplay !== 'off' ? REL_H : 0)
  const relText = (b: BunsetsuVM) => (b.relation ? t(RELATION_TERM_KEYS[b.relation]) : null)
  // latin badge at 10px is ~0.6× the 17px-font estimate textWidth gives
  const relWidth = (label: string | null) => {
    return label ? Math.ceil(textWidth(label) * 0.6) + 8 : 0
  }

  const isClauseHead = (b: BunsetsuVM) => b.relation === 'relclause' || b.relation === 'linkedclause'
  // arrows mode: a box badge only where it is true of the box itself — the
  // root is the main predicate, a clause head is its own clause's predicate
  const badgeText = (b: BunsetsuVM): string | null => {
    if (relationDisplay === 'badges') return relText(b)
    if (relationDisplay !== 'arrows') return null
    if (b.head === null) return t('relPredicate')
    return isClauseHead(b) ? t('relClausePredicate') : null
  }

  const widths = $derived(
    bunsetsu.map((b) =>
      Math.max(
        textWidth(b.surface) + 2 * BOX_PAD,
        relationDisplay === 'badges' ? relWidth(relText(b)) : 0,
        relationDisplay === 'arrows' ? Math.max(relWidth(badgeText(b)), b.head !== null ? relWidth(relText(b)) : 0) : 0,
      ),
    ),
  )
  const layout = $derived(layoutTree(widths, bunsetsu.map((b) => b.head), 20, relationDisplay === 'arrows' ? 88 : 70))
  const pos = $derived(new Map(layout.nodes.map((n) => [n.index, n])))
  const topPad = $derived(showFurigana ? FURI_H : 0)

  const chain = $derived(
    selected !== null && chainColor !== 'none'
      ? chainFrom(bunsetsu.map((b) => b.head), selected)
      : { links: new Set<number>(), boxes: new Set<number>() },
  )
  const palette = $derived(selected !== null && chainColor !== 'none' ? CHAIN_PALETTE[chainColor] : null)

  const extentFor = (i: number | null) =>
    i !== null && (bunsetsu[i]?.relation === 'relclause' || bunsetsu[i]?.relation === 'linkedclause') ? i : null
  // single-bunsetsu clauses get no bracket: the box itself already shows the extent
  const extent = $derived.by(() => {
    const i = extentFor(hovered) ?? extentFor(selected)
    if (i === null) return null
    const span = subtreeSpan(bunsetsu.map((b) => b.head), i)
    return span.from === span.to ? null : { ...span, label: relText(bunsetsu[i]) }
  })

  const bracket = $derived.by(() => {
    if (!extent) return null
    const span = extent
    const inSpan = (i: number) => i >= span.from && i <= span.to
    const nodesIn = layout.nodes.filter((n) => inSpan(n.index))
    const minX = Math.min(...nodesIn.map((n) => n.x - widths[n.index] / 2))
    const maxX = Math.max(...nodesIn.map((n) => n.x + widths[n.index] / 2))
    const rows = new Set(nodesIn.map((n) => n.y))
    // a side with NO foreign box in the span's rows is fully open, regardless
    // of distance to the diagram edge — the card has white space beyond
    let leftGap = Infinity
    let rightGap = Infinity
    for (const n of layout.nodes) {
      if (inSpan(n.index) || !rows.has(n.y)) continue
      const l = n.x - widths[n.index] / 2
      const r = n.x + widths[n.index] / 2
      if (r <= minX) leftGap = Math.min(leftGap, minX - r)
      if (l >= maxX) rightGap = Math.min(rightGap, l - maxX)
    }
    const right = rightGap >= leftGap
    const x = right ? Math.min(maxX + 8 + PAD_X, layout.width + 2 * PAD_X + 8) : Math.max(minX - 8 + PAD_X, 2)
    const tick = right ? -6 : 6
    const top = Math.min(...nodesIn.map((n) => n.y)) + topPad
    const bottom = Math.max(...nodesIn.map((n) => n.y)) + topPad + BOX_H + relH
    return `M ${x + tick} ${top} H ${x} V ${bottom} H ${x + tick}`
  })
</script>

<div class="tree-scroll">
  <svg
    width={layout.width + 2 * PAD_X + 12}
    height={layout.height + BOX_H + 6 + topPad + relH}
    class="nodetree"
    role="group"
    aria-label={t('treeGroupLabel')}
    style={palette ? `--chain: ${palette.line}; --chain-soft: ${palette.soft}` : undefined}
  >
    {#each layout.edges as e (e.to)}
      {@const from = pos.get(e.from)!}
      {@const to = pos.get(e.to)!}
      {@const label = confidenceLabel(bunsetsu[e.to])}
      {@const x1 = from.x + PAD_X}
      {@const y1 = from.y + BOX_H + topPad + (badgeText(bunsetsu[e.from]) ? REL_H : 0)}
      {@const x2 = to.x + PAD_X}
      {@const y2 = to.y + topPad}
      <g class="connector">
        {#if label}
          <title>{label}</title>
        {/if}
        <line
          class="edge"
          class:low={showConfidence && isUncertain(bunsetsu[e.to], confidenceThreshold) && !bunsetsu[e.to].forced}
          class:forced={showConfidence && isUncertain(bunsetsu[e.to], confidenceThreshold) && bunsetsu[e.to].forced}
          class:hl={hovered === e.to || selected === e.to}
          class:chain={chain.links.has(e.to)}
          {x1}
          {y1}
          {x2}
          {y2}
        />
        <line class="hit" {x1} {y1} {x2} {y2} />
      </g>
    {/each}
    {#each layout.nodes as n (n.index)}
      {@const b = bunsetsu[n.index]}
      <g
        class="bunsetsu"
        class:selected={selected === n.index}
        class:hl={hovered === n.index || (hovered !== null && bunsetsu[hovered].head === n.index)}
        class:root={b.head === null}
        class:chain={chain.boxes.has(n.index)}
        role="button"
        tabindex="0"
        aria-label={b.surface}
        onmouseenter={() => (hovered = n.index)}
        onmouseleave={() => (hovered = null)}
        onclick={(e) => {
          e.stopPropagation()
          onselect(n.index)
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onselect(n.index)
          }
        }}
      >
        {#if relationDisplay === 'arrows' && b.head !== null && relText(b)}
          <text class="relation-label on-edge" aria-hidden="true" x={n.x + PAD_X} y={n.y + topPad - (showFurigana ? FURI_H : 0) - 4} text-anchor="middle">{relText(b)}</text>
        {/if}
        {#if showFurigana && b.reading}
          <text class="furigana" x={n.x + PAD_X} y={n.y + topPad - 4} text-anchor="middle">{b.reading}</text>
        {/if}
        <rect x={n.x - widths[n.index] / 2 + PAD_X} y={n.y + topPad} width={widths[n.index]} height={BOX_H} rx="6" />
        <text class="surface" x={n.x + PAD_X} y={n.y + 22 + topPad} text-anchor="middle">{b.surface}</text>
        {#if badgeText(b)}
          <text class="relation-label" aria-hidden="true" x={n.x + PAD_X} y={n.y + topPad + BOX_H + 11} text-anchor="middle">{badgeText(b)}</text>
        {/if}
      </g>
    {/each}
    {#if bracket}
      <path class="extent-bracket" aria-hidden="true" d={bracket} />
    {/if}
  </svg>
</div>
