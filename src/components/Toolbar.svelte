<script lang="ts">
  let {
    showFurigana = $bindable(),
    view = $bindable(),
    rate = $bindable(),
  }: {
    showFurigana: boolean
    view: 'arcs' | 'tree'
    rate: number
  } = $props()
</script>

<div class="toolbar">
  <label class="toggle"><input type="checkbox" bind:checked={showFurigana} /> ルビ furigana</label>
  <div class="views" role="group" aria-label="tree view style">
    <button class:active={view === 'arcs'} aria-pressed={view === 'arcs'} onclick={() => (view = 'arcs')}>⌒ arcs</button>
    <button class:active={view === 'tree'} aria-pressed={view === 'tree'} onclick={() => (view = 'tree')}>🌳 tree</button>
  </div>
  <label class="rate">
    🔊 {rate.toFixed(1)}×
    <input type="range" min="0.5" max="1.5" step="0.1" bind:value={rate} aria-label="speech rate" />
  </label>
</div>
