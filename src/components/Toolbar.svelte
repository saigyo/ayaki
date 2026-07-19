<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import type { ViewKind } from '../lib/settings'

  let {
    showFurigana = $bindable(),
    view = $bindable(),
    onviewclick = () => {},
  }: {
    showFurigana: boolean
    view: ViewKind
    onviewclick?: () => void
  } = $props()
</script>

<div class="toolbar">
  <div class="views" role="group" aria-label={t('viewGroupLabel')}>
    <button class:active={view === 'arcs'} aria-pressed={view === 'arcs'} onclick={() => { view = 'arcs'; onviewclick() }}>⌒ {t('viewArcs')}</button>
    <button class:active={view === 'tree'} aria-pressed={view === 'tree'} onclick={() => { view = 'tree'; onviewclick() }}>🌳 {t('viewTree')}</button>
    <button class:active={view === 'cabocha'} aria-pressed={view === 'cabocha'} onclick={() => { view = 'cabocha'; onviewclick() }}>🎃 {t('viewCabocha')}</button>
  </div>
  <label class="toggle"><input type="checkbox" bind:checked={showFurigana} /> {t('furiganaToggle')}</label>
</div>
