<script lang="ts">
  import { layoutArcs, textWidth } from '../lib/arclayout'
  import { subtreeSpan } from '../lib/extent'
  import { confidenceLabel, isUncertain, LOW_CONFIDENCE } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'
  import { t } from '../lib/i18n.svelte'
  import { RELATION_TERM_KEYS } from '../lib/relations'
  import { CHAIN_PALETTE, chainFrom, type ChainColor } from '../lib/chainpalette'
  import type { ArrowDirection, RelationDisplay } from '../lib/settings'

  let {
    bunsetsu,
    showFurigana = false,
    showConfidence = false,
    confidenceThreshold = LOW_CONFIDENCE,
    selected = null,
    chainColor = 'none',
    relationDisplay = 'off',
    arrowDirection = 'ud',
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    showFurigana?: boolean
    showConfidence?: boolean
    confidenceThreshold?: number
    selected?: number | null
    chainColor?: ChainColor
    relationDisplay?: RelationDisplay
    arrowDirection?: ArrowDirection
    onselect: (index: number) => void
  } = $props()

  const uid = $props.id()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const FURI_H = 16
  const PAD_X = 4
  const REL_H = 15

  const relH = $derived(relationDisplay !== 'off' ? REL_H : 0)
  const relText = (b: BunsetsuVM) => (b.relation ? t(RELATION_TERM_KEYS[b.relation]) : null)
  // latin badge at 10px is ~0.6× the 17px-font estimate textWidth gives
  const relWidth = (b: BunsetsuVM) => {
    const label = relText(b)
    return label ? Math.ceil(textWidth(label) * 0.6) + 8 : 0
  }

  const isClauseHead = (b: BunsetsuVM) => b.relation === 'relclause' || b.relation === 'linkedclause'
  // arrows mode: a box badge only where it is true of the box itself — the
  // root is the main predicate, a clause head is its own clause's predicate
  const badgeText = (b: BunsetsuVM): string | null => {
    // a clause head reads "predicate" in both badge modes — its clause type is
    // named by the (arc-only) extent bracket, so the box must not repeat it
    if (relationDisplay === 'badges') return isClauseHead(b) ? t('relClausePredicate') : relText(b)
    if (relationDisplay !== 'arrows') return null
    if (b.head === null) return t('relPredicate')
    return isClauseHead(b) ? t('relClausePredicate') : null
  }

  const layout = $derived(
    layoutArcs(
      bunsetsu.map((b) => b.surface),
      bunsetsu.map((b) => b.head),
      relationDisplay === 'arrows' ? (showFurigana ? 42 : 34) : showFurigana ? 30 : 22,
      relationDisplay !== 'off' ? bunsetsu.map(relWidth) : undefined,
      relationDisplay === 'arrows' ? 22 : 14,
    ),
  )
  const boxTop = $derived(layout.arcAreaHeight + (showFurigana ? FURI_H : 0))
  const svgHeight = $derived(boxTop + BOX_H + 6 + relH + 22)

  const extentFor = (i: number | null) =>
    i !== null && (bunsetsu[i]?.relation === 'relclause' || bunsetsu[i]?.relation === 'linkedclause') ? i : null
  // single-bunsetsu clauses get no bracket: the box itself already shows the extent
  const extent = $derived.by(() => {
    const i = extentFor(hovered) ?? extentFor(selected)
    if (i === null) return null
    const span = subtreeSpan(bunsetsu.map((b) => b.head), i)
    return span.from === span.to ? null : { ...span, label: relText(bunsetsu[i]) }
  })

  const chain = $derived(
    selected !== null && chainColor !== 'none'
      ? chainFrom(bunsetsu.map((b) => b.head), selected)
      : { links: new Set<number>(), boxes: new Set<number>() },
  )
  const palette = $derived(selected !== null && chainColor !== 'none' ? CHAIN_PALETTE[chainColor] : null)

  function arcClass(dep: number): string {
    const b = bunsetsu[dep]
    const cls = ['arc']
    if (showConfidence && isUncertain(b, confidenceThreshold)) cls.push(b.forced ? 'forced' : 'low')
    if (hovered === dep || selected === dep) cls.push('hl')
    if (chain.links.has(dep)) cls.push('chain')
    return cls.join(' ')
  }
</script>

<div class="tree-scroll">
  <svg
    width={layout.width + 2 * PAD_X}
    height={svgHeight}
    class="arcdiagram"
    role="group"
    aria-label={t('arcsGroupLabel')}
    style={palette ? `--chain: ${palette.line}; --chain-soft: ${palette.soft}` : undefined}
  >
    <defs>
      <marker id="arrowhead-{uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
      {#if palette}
        <marker id="arrowhead-chain-{uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--chain)" />
        </marker>
      {/if}
    </defs>
    {#each layout.arcs as a (a.dep)}
      {@const label = confidenceLabel(bunsetsu[a.dep])}
      <!-- x1 is the dependent (left), x2 the head (right): attach on the box half
           facing the other end so incoming and outgoing arcs separate visually -->
      {@const xDep = a.x1 + 6}
      {@const xHead = a.x2 - 6}
      {@const [xFrom, xTo] = arrowDirection === 'ud' ? [xHead, xDep] : [xDep, xHead]}
      <!-- pulling the control points inward slants the end tangents, so the
           auto-oriented arrowheads follow the arc's apparent angle instead of
           pointing straight down -->
      {@const pull = 0.15 * (xTo - xFrom)}
      {@const d = `M ${xFrom + PAD_X} ${boxTop} C ${xFrom + pull + PAD_X} ${boxTop - a.top}, ${xTo - pull + PAD_X} ${boxTop - a.top}, ${xTo + PAD_X} ${boxTop}`}
      <g class="connector">
        {#if label}
          <title>{label}</title>
        {/if}
        <path class={arcClass(a.dep)} {d} marker-end={chain.links.has(a.dep) ? `url(#arrowhead-chain-${uid})` : `url(#arrowhead-${uid})`} />
        <path class="hit" {d} />
        {#if relationDisplay === 'arrows' && relText(bunsetsu[a.dep])}
          <text class="relation-label on-edge" aria-hidden="true" x={(a.x1 + a.x2) / 2 + PAD_X} y={boxTop - a.top * 0.75 - 4} text-anchor="middle">{relText(bunsetsu[a.dep])}</text>
        {/if}
      </g>
    {/each}
    {#each bunsetsu as b, i (b.index)}
      {@const box = layout.boxes[i]}
      <g
        class="bunsetsu"
        class:selected={selected === i}
        class:hl={hovered === i || (hovered !== null && bunsetsu[hovered].head === i)}
        class:root={b.head === null}
        class:chain={chain.boxes.has(i)}
        role="button"
        tabindex="0"
        aria-label={b.surface}
        onmouseenter={() => (hovered = i)}
        onmouseleave={() => (hovered = null)}
        onclick={(e) => {
          e.stopPropagation()
          onselect(i)
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onselect(i)
          }
        }}
      >
        {#if showFurigana && b.reading}
          <text class="furigana" x={box.cx + PAD_X} y={boxTop - 4} text-anchor="middle">{b.reading}</text>
        {/if}
        <rect x={box.x + PAD_X} y={boxTop} width={box.width} height={BOX_H} rx="6" />
        <text class="surface" x={box.cx + PAD_X} y={boxTop + 22} text-anchor="middle">{b.surface}</text>
        {#if badgeText(b)}
          <text class="relation-label" aria-hidden="true" x={box.cx + PAD_X} y={boxTop + BOX_H + 11} text-anchor="middle">{badgeText(b)}</text>
        {/if}
      </g>
    {/each}
    {#if extent}
      {@const bx1 = layout.boxes[extent.from].x + PAD_X}
      {@const bx2 = layout.boxes[extent.to].x + layout.boxes[extent.to].width + PAD_X}
      {@const by = boxTop + BOX_H + relH + 6}
      <path class="extent-bracket" aria-hidden="true" d="M {bx1} {by - 5} V {by} H {bx2} V {by - 5}" />
      <text class="extent-label" aria-hidden="true" x={(bx1 + bx2) / 2} y={by + 12} text-anchor="middle">{extent.label}</text>
    {/if}
  </svg>
</div>
