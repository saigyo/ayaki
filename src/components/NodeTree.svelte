<script lang="ts">
  import { textWidth } from '../lib/arclayout'
  import { layoutTree } from '../lib/treelayout'
  import { isUncertain } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'

  let {
    bunsetsu,
    selected = null,
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    selected?: number | null
    onselect: (index: number) => void
  } = $props()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const BOX_PAD = 10
  const PAD_X = 4

  const widths = $derived(bunsetsu.map((b) => textWidth(b.surface) + 2 * BOX_PAD))
  const layout = $derived(layoutTree(widths, bunsetsu.map((b) => b.head)))
  const pos = $derived(new Map(layout.nodes.map((n) => [n.index, n])))
</script>

<div class="tree-scroll">
  <svg width={layout.width + 2 * PAD_X} height={layout.height + BOX_H + 6} class="nodetree" role="group" aria-label="dependency tree">
    {#each layout.edges as e (e.to)}
      {@const from = pos.get(e.from)!}
      {@const to = pos.get(e.to)!}
      <line
        class="edge"
        class:low={!bunsetsu[e.to].forced && isUncertain(bunsetsu[e.to])}
        class:forced={bunsetsu[e.to].forced}
        class:hl={hovered === e.to || selected === e.to}
        x1={from.x + PAD_X}
        y1={from.y + BOX_H}
        x2={to.x + PAD_X}
        y2={to.y}
      >
      </line>
    {/each}
    {#each layout.nodes as n (n.index)}
      {@const b = bunsetsu[n.index]}
      <g
        class="bunsetsu"
        class:selected={selected === n.index}
        class:hl={hovered === n.index || (hovered !== null && bunsetsu[hovered].head === n.index)}
        class:root={b.head === null}
        role="button"
        tabindex="0"
        onmouseenter={() => (hovered = n.index)}
        onmouseleave={() => (hovered = null)}
        onclick={() => onselect(n.index)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onselect(n.index)
          }
        }}
      >
        <rect x={n.x - widths[n.index] / 2 + PAD_X} y={n.y} width={widths[n.index]} height={BOX_H} rx="6" />
        <text class="surface" x={n.x + PAD_X} y={n.y + 22} text-anchor="middle">{b.surface}</text>
      </g>
    {/each}
  </svg>
</div>
