<script lang="ts">
  import { layoutArcs } from '../lib/arclayout'
  import { confidenceLabel, isUncertain } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'
  import { t } from '../lib/i18n.svelte'

  let {
    bunsetsu,
    showFurigana = false,
    selected = null,
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    showFurigana?: boolean
    selected?: number | null
    onselect: (index: number) => void
  } = $props()

  const uid = $props.id()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const FURI_H = 16
  const PAD_X = 4

  const layout = $derived(layoutArcs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head)))
  const boxTop = $derived(layout.arcAreaHeight + (showFurigana ? FURI_H : 0))
  const svgHeight = $derived(boxTop + BOX_H + 6)

  function arcClass(dep: number): string {
    const b = bunsetsu[dep]
    const cls = ['arc']
    if (b.forced) cls.push('forced')
    else if (isUncertain(b)) cls.push('low')
    if (hovered === dep || selected === dep) cls.push('hl')
    return cls.join(' ')
  }
</script>

<div class="tree-scroll">
  <svg width={layout.width + 2 * PAD_X} height={svgHeight} class="arcdiagram" role="group" aria-label={t('arcsGroupLabel')}>
    <defs>
      <marker id="arrowhead-{uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
    </defs>
    {#each layout.arcs as a (a.dep)}
      {@const label = confidenceLabel(bunsetsu[a.dep])}
      <path
        class={arcClass(a.dep)}
        d="M {a.x1 + PAD_X} {boxTop} C {a.x1 + PAD_X} {boxTop - a.top}, {a.x2 + PAD_X} {boxTop - a.top}, {a.x2 + PAD_X} {boxTop}"
        marker-end="url(#arrowhead-{uid})"
      >
        {#if label}
          <title>{label}</title>
        {/if}
      </path>
    {/each}
    {#each bunsetsu as b, i (b.index)}
      {@const box = layout.boxes[i]}
      <g
        class="bunsetsu"
        class:selected={selected === i}
        class:hl={hovered === i || (hovered !== null && bunsetsu[hovered].head === i)}
        class:root={b.head === null}
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
      </g>
    {/each}
  </svg>
</div>
