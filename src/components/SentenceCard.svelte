<script lang="ts">
  import ArcDiagram from './ArcDiagram.svelte'
  import NodeTree from './NodeTree.svelte'
  import type { ParsedSentence } from '../lib/types'

  let {
    sentence,
    view,
    showFurigana,
    selected,
    onselect,
  }: {
    sentence: ParsedSentence
    view: 'arcs' | 'tree'
    showFurigana: boolean
    selected: number | null
    onselect: (index: number) => void
  } = $props()
</script>

<div class="card">
  {#if sentence.error}
    <p class="sentence-error"><span lang="ja">{sentence.text}</span> — could not parse: {sentence.error}</p>
  {:else if view === 'arcs'}
    <ArcDiagram bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {:else}
    <NodeTree bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {/if}
</div>
