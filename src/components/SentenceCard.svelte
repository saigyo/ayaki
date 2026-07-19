<script lang="ts">
  import ArcDiagram from './ArcDiagram.svelte'
  import NodeTree from './NodeTree.svelte'
  import StairView from './StairView.svelte'
  import { t } from '../lib/i18n.svelte'
  import { type ViewKind } from '../lib/settings'
  import type { ParsedSentence } from '../lib/types'
  import type { ChainColor } from '../lib/chainpalette'
  import { LOW_CONFIDENCE } from '../lib/viewmodel'

  let {
    sentence,
    view,
    showFurigana,
    selected,
    onselect,
    active = false,
    onactivate = () => {},
    showConfidence = false,
    confidenceThreshold = LOW_CONFIDENCE,
    chainColor = 'none',
  }: {
    sentence: ParsedSentence
    view: ViewKind
    showFurigana: boolean
    selected: number | null
    onselect: (index: number) => void
    active?: boolean
    onactivate?: () => void
    showConfidence?: boolean
    confidenceThreshold?: number
    chainColor?: ChainColor
  } = $props()
</script>

<!-- Pointer-only convenience: keyboard users reach the same states via the bunsetsu
     buttons (Enter/Space selects and activates the sentence) and Escape (deselect).
     Making the card focusable would nest a widget around real buttons, which is
     worse for assistive technology. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="card" class:active onclick={onactivate}>
  {#if sentence.error}
    <p class="sentence-error"><span lang="ja">{sentence.text}</span> — {t('sentenceError', { message: sentence.error })}</p>
  {:else if view === 'arcs'}
    <ArcDiagram bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} {showConfidence} {confidenceThreshold} {chainColor} />
  {:else if view === 'tree'}
    <NodeTree bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} {showConfidence} {confidenceThreshold} {chainColor} />
  {:else}
    <StairView bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} {showConfidence} {confidenceThreshold} {chainColor} />
  {/if}
</div>
