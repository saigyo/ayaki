<script lang="ts">
  import { onMount } from 'svelte'
  import { listJaVoices } from '../lib/speech'
  import { t, type Locale, SUPPORTED_LOCALES } from '../lib/i18n.svelte'

  let {
    showFurigana = $bindable(),
    view = $bindable(),
    rate = $bindable(),
    voiceURI = $bindable(null),
    locale = $bindable(null),
  }: {
    showFurigana: boolean
    view: 'arcs' | 'tree'
    rate: number
    voiceURI?: string | null
    locale?: Locale | null
  } = $props()

  let voices = $state<SpeechSynthesisVoice[]>([])
  onMount(() => {
    const update = () => (voices = listJaVoices())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const storedVoicePresent = $derived(voices.some((v) => v.voiceURI === voiceURI))

  const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch', ja: '日本語', zh: '中文' }
</script>

<div class="toolbar">
  <label class="toggle"><input type="checkbox" bind:checked={showFurigana} /> {t('furiganaToggle')}</label>
  <div class="views" role="group" aria-label={t('viewGroupLabel')}>
    <button class:active={view === 'arcs'} aria-pressed={view === 'arcs'} onclick={() => (view = 'arcs')}>⌒ {t('viewArcs')}</button>
    <button class:active={view === 'tree'} aria-pressed={view === 'tree'} onclick={() => (view = 'tree')}>🌳 {t('viewTree')}</button>
  </div>
  <label class="rate">
    🔊 {rate.toFixed(1)}×
    <input type="range" min="0.5" max="1.5" step="0.1" bind:value={rate} aria-label={t('rateLabel')} />
  </label>
  {#if voices.length > 0}
    <select class="voice" aria-label={t('voiceLabel')} onchange={(e) => (voiceURI = e.currentTarget.value || null)}>
      <!-- per-option selected attributes (not bind:value): a stored-but-absent voice
           must DISPLAY as auto without overwriting the stored value -->
      <option value="" selected={voiceURI === null || !storedVoicePresent}>{t('voiceAuto')}</option>
      {#each voices as v}
        <option value={v.voiceURI} selected={v.voiceURI === voiceURI}>{v.name}</option>
      {/each}
    </select>
  {/if}
  <select class="locale" aria-label={t('localeLabel')} onchange={(e) => (locale = (e.currentTarget.value || null) as Locale | null)}>
    <option value="" selected={locale === null}>{t('localeAuto')}</option>
    {#each SUPPORTED_LOCALES as l}
      <option value={l} selected={l === locale}>{LOCALE_NAMES[l]}</option>
    {/each}
  </select>
</div>
