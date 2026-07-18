<script lang="ts">
  import { onMount } from 'svelte'
  import { listJaVoices } from '../lib/speech'

  let {
    showFurigana = $bindable(),
    view = $bindable(),
    rate = $bindable(),
    voiceURI = $bindable(null),
  }: {
    showFurigana: boolean
    view: 'arcs' | 'tree'
    rate: number
    voiceURI?: string | null
  } = $props()

  let voices = $state<SpeechSynthesisVoice[]>([])
  onMount(() => {
    const update = () => (voices = listJaVoices())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const storedVoicePresent = $derived(voices.some((v) => v.voiceURI === voiceURI))
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
  {#if voices.length > 0}
    <select class="voice" aria-label="voice" onchange={(e) => (voiceURI = e.currentTarget.value || null)}>
      <!-- per-option selected attributes (not bind:value): a stored-but-absent voice
           must DISPLAY as auto without overwriting the stored value -->
      <option value="" selected={voiceURI === null || !storedVoicePresent}>自動 auto</option>
      {#each voices as v}
        <option value={v.voiceURI} selected={v.voiceURI === voiceURI}>{v.name}</option>
      {/each}
    </select>
  {/if}
</div>
