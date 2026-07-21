<script lang="ts">
  import { layoutArcs, textWidth } from '../lib/arclayout'
  import { confidenceLabel, isUncertain, LOW_CONFIDENCE } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'
  import { t } from '../lib/i18n.svelte'
  import { RELATION_TERM_KEYS } from '../lib/relations'
  import { CHAIN_PALETTE, chainFrom, type ChainColor } from '../lib/chainpalette'

  let {
    bunsetsu,
    showFurigana = false,
    showConfidence = false,
    confidenceThreshold = LOW_CONFIDENCE,
    selected = null,
    chainColor = 'none',
    showRelations = false,
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    showFurigana?: boolean
    showConfidence?: boolean
    confidenceThreshold?: number
    selected?: number | null
    chainColor?: ChainColor
    showRelations?: boolean
    onselect: (index: number) => void
  } = $props()

  const uid = $props.id()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const FURI_H = 16
  const PAD_X = 4
  const REL_H = 15

  const relH = $derived(showRelations ? REL_H : 0)
  const relText = (b: BunsetsuVM) => (b.relation ? t(RELATION_TERM_KEYS[b.relation]) : null)
  // latin badge at 10px is ~0.6× the 17px-font estimate textWidth gives
  const relWidth = (b: BunsetsuVM) => {
    const label = relText(b)
    return label ? Math.ceil(textWidth(label) * 0.6) + 8 : 0
  }

  const layout = $derived(
    layoutArcs(
      bunsetsu.map((b) => b.surface),
      bunsetsu.map((b) => b.head),
      showFurigana ? 30 : 22,
      showRelations ? bunsetsu.map(relWidth) : undefined,
    ),
  )
  const boxTop = $derived(layout.arcAreaHeight + (showFurigana ? FURI_H : 0))
  const svgHeight = $derived(boxTop + BOX_H + 6 + relH)

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
      {@const d = `M ${a.x1 + PAD_X} ${boxTop} C ${a.x1 + PAD_X} ${boxTop - a.top}, ${a.x2 + PAD_X} ${boxTop - a.top}, ${a.x2 + PAD_X} ${boxTop}`}
      <g class="connector">
        {#if label}
          <title>{label}</title>
        {/if}
        <path class={arcClass(a.dep)} {d} marker-end={chain.links.has(a.dep) ? `url(#arrowhead-chain-${uid})` : `url(#arrowhead-${uid})`} />
        <path class="hit" {d} />
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
        {#if showRelations && relText(b)}
          <text class="relation-label" aria-hidden="true" x={box.cx + PAD_X} y={boxTop + BOX_H + 11} text-anchor="middle">{relText(b)}</text>
        {/if}
      </g>
    {/each}
  </svg>
</div>
