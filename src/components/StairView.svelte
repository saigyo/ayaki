<script lang="ts">
  import { layoutStairs } from '../lib/stairlayout'
  import { confidenceLabel, isUncertain, LOW_CONFIDENCE } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'
  import { t } from '../lib/i18n.svelte'
  import { CHAIN_PALETTE, chainFrom, type ChainColor } from '../lib/chainpalette'

  let {
    bunsetsu,
    showFurigana = false,
    showConfidence = false,
    confidenceThreshold = LOW_CONFIDENCE,
    selected = null,
    chainColor = 'none',
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    showFurigana?: boolean
    showConfidence?: boolean
    confidenceThreshold?: number
    selected?: number | null
    chainColor?: ChainColor
    onselect: (index: number) => void
  } = $props()

  const uid = $props.id()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const FURI_H = 16
  const ROW_GAP = 12
  const PAD = 4

  const furiH = $derived(showFurigana ? FURI_H : 0)
  const layout = $derived(
    layoutStairs(
      bunsetsu.map((b) => b.surface),
      bunsetsu.map((b) => b.head),
      { rowHeight: furiH + BOX_H + ROW_GAP, boxCenterOffset: furiH + BOX_H / 2 },
    ),
  )

  const chain = $derived(
    selected !== null && chainColor !== 'none'
      ? chainFrom(bunsetsu.map((b) => b.head), selected)
      : { links: new Set<number>(), boxes: new Set<number>() },
  )
  const palette = $derived(selected !== null && chainColor !== 'none' ? CHAIN_PALETTE[chainColor] : null)

  function connectorClass(dep: number): string {
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
    width={layout.width + 2 * PAD}
    height={layout.height + PAD}
    class="stairview"
    role="group"
    aria-label={t('stairsGroupLabel')}
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
    <g transform="translate({PAD}, 2)">
      {#each layout.connectors as c (c.dep)}
        {@const label = confidenceLabel(bunsetsu[c.dep])}
        <g class="connector">
          {#if label}
            <title>{label}</title>
          {/if}
          <path
            class={connectorClass(c.dep)}
            d={c.d}
            marker-end={chain.links.has(c.dep) ? `url(#arrowhead-chain-${uid})` : `url(#arrowhead-${uid})`}
          />
          <path class="hit" d={c.d} />
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
            <text class="furigana" x={box.x + box.width / 2} y={box.y + FURI_H - 4} text-anchor="middle">{b.reading}</text>
          {/if}
          <rect x={box.x} y={box.y + furiH} width={box.width} height={BOX_H} rx="6" />
          <text class="surface" x={box.x + box.width / 2} y={box.y + furiH + 22} text-anchor="middle">{b.surface}</text>
        </g>
      {/each}
    </g>
  </svg>
</div>
