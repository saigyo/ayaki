<script lang="ts">
  import { textWidth } from '../lib/arclayout'
  import { layoutTree } from '../lib/treelayout'
  import { confidenceLabel, isUncertain } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'
  import { t } from '../lib/i18n.svelte'
  import { CHAIN_PALETTE, chainFrom, type ChainColor } from '../lib/chainpalette'

  let {
    bunsetsu,
    showFurigana = false,
    showConfidence = false,
    selected = null,
    chainColor = 'none',
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    showFurigana?: boolean
    showConfidence?: boolean
    selected?: number | null
    chainColor?: ChainColor
    onselect: (index: number) => void
  } = $props()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const BOX_PAD = 10
  const PAD_X = 4
  const FURI_H = 16

  const widths = $derived(bunsetsu.map((b) => textWidth(b.surface) + 2 * BOX_PAD))
  const layout = $derived(layoutTree(widths, bunsetsu.map((b) => b.head)))
  const pos = $derived(new Map(layout.nodes.map((n) => [n.index, n])))
  const topPad = $derived(showFurigana ? FURI_H : 0)

  const chain = $derived(
    selected !== null && chainColor !== 'none'
      ? chainFrom(bunsetsu.map((b) => b.head), selected)
      : { links: new Set<number>(), boxes: new Set<number>() },
  )
  const palette = $derived(chainColor !== 'none' ? CHAIN_PALETTE[chainColor] : null)
</script>

<div class="tree-scroll">
  <svg
    width={layout.width + 2 * PAD_X}
    height={layout.height + BOX_H + 6 + topPad}
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
      {@const y1 = from.y + BOX_H + topPad}
      {@const x2 = to.x + PAD_X}
      {@const y2 = to.y + topPad}
      <g class="connector">
        {#if label}
          <title>{label}</title>
        {/if}
        <line
          class="edge"
          class:low={showConfidence && !bunsetsu[e.to].forced && isUncertain(bunsetsu[e.to])}
          class:forced={showConfidence && bunsetsu[e.to].forced}
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
        {#if showFurigana && b.reading}
          <text class="furigana" x={n.x + PAD_X} y={n.y + topPad - 4} text-anchor="middle">{b.reading}</text>
        {/if}
        <rect x={n.x - widths[n.index] / 2 + PAD_X} y={n.y + topPad} width={widths[n.index]} height={BOX_H} rx="6" />
        <text class="surface" x={n.x + PAD_X} y={n.y + 22 + topPad} text-anchor="middle">{b.surface}</text>
      </g>
    {/each}
  </svg>
</div>
