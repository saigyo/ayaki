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
    active = false,
    onactivate = () => {},
  }: {
    sentence: ParsedSentence
    view: 'arcs' | 'tree'
    showFurigana: boolean
    selected: number | null
    onselect: (index: number) => void
    active?: boolean
    onactivate?: () => void
  } = $props()
</script>

<!-- Pointer-only convenience: keyboard users reach the same states via the bunsetsu
     buttons (Enter/Space selects and activates the sentence) and Escape (deselect).
     Making the card focusable would nest a widget around real buttons, which is
     worse for assistive technology. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="card" class:active onclick={onactivate}>
  {#if sentence.error}
    <p class="sentence-error"><span lang="ja">{sentence.text}</span> — could not parse: {sentence.error}</p>
  {:else if view === 'arcs'}
    <ArcDiagram bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {:else}
    <NodeTree bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {/if}
</div>
