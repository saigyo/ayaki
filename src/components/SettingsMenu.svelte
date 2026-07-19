<script lang="ts">
  import { onMount } from 'svelte'
  import { listJaVoices } from '../lib/speech'
  import { t } from '../lib/i18n.svelte'

  let {
    rate = $bindable(),
    voiceURI = $bindable(null),
  }: {
    rate: number
    voiceURI?: string | null
  } = $props()

  const uid = $props.id()
  let open = $state(false)
  let root: HTMLElement
  let gear: HTMLButtonElement

  let voices = $state<SpeechSynthesisVoice[]>([])
  onMount(() => {
    const update = () => (voices = listJaVoices())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const storedVoicePresent = $derived(voices.some((v) => v.voiceURI === voiceURI))
  const noVoices = $derived(voices.length === 0)

  // document-level listeners exist only while the popup is open
  $effect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!root.contains(e.target as Node)) open = false
    }
    const onDocKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // the popup swallows Escape: App's window-level handler (clear the
      // bunsetsu selection) must not also fire
      e.stopPropagation()
      open = false
      gear.focus()
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onDocKeydown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onDocKeydown)
    }
  })
</script>

<div class="settings-menu" bind:this={root}>
  <button
    class="icon-button"
    bind:this={gear}
    aria-expanded={open}
    aria-label={t('settingsLabel')}
    onclick={() => (open = !open)}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  </button>
  {#if open}
    <div class="settings-popup">
      <div class="row">
        <label class="row-label" for="voice-{uid}">{t('voiceLabel')}</label>
        <select
          id="voice-{uid}"
          disabled={noVoices}
          title={noVoices ? t('noVoice') : undefined}
          onchange={(e) => (voiceURI = e.currentTarget.value || null)}
        >
          <!-- per-option selected attributes (not bind:value): a stored-but-absent voice
               must DISPLAY as auto without overwriting the stored value -->
          <option value="" selected={voiceURI === null || !storedVoicePresent}>{t('voiceAuto')}</option>
          {#each voices as v}
            <option value={v.voiceURI} selected={v.voiceURI === voiceURI}>{v.name}</option>
          {/each}
        </select>
      </div>
      <div class="row">
        <label class="row-label" for="rate-{uid}">{t('rateLabel')}</label>
        <span class="rate-row">
          <input
            id="rate-{uid}"
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            bind:value={rate}
            disabled={noVoices}
            title={noVoices ? t('noVoice') : undefined}
          />
          <span>{rate.toFixed(1)}×</span>
        </span>
      </div>
      {#if noVoices}
        <p class="no-voice-note">{t('noVoice')}</p>
      {/if}
    </div>
  {/if}
</div>
