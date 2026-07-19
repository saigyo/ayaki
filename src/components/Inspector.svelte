<script lang="ts">
  import { onMount } from 'svelte'
  import { googleTranslateUrl } from '../lib/links'
  import { speak, speechAvailable, stopSpeech } from '../lib/speech'
  import { confidenceLabel, isUncertain } from '../lib/viewmodel'
  import { currentLocale, t } from '../lib/i18n.svelte'
  import { conjugationGloss, posGloss } from '../lib/pos'
  import type { BunsetsuVM, ParsedSentence } from '../lib/types'

  let {
    sentence,
    index,
    total,
    selected,
    rate,
    voiceURI,
    showConfidence = false,
    shareUrl = '',
  }: {
    sentence: ParsedSentence | null
    index: number
    total: number
    selected: BunsetsuVM | null
    rate: number
    voiceURI: string | null
    showConfidence?: boolean
    shareUrl?: string
  } = $props()

  let canSpeak = $state(false)
  onMount(() => {
    const update = () => (canSpeak = speechAvailable())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const speakTitle = $derived(canSpeak ? t('speakTitle') : t('noVoice'))
  const uncertainCount = $derived(sentence ? sentence.bunsetsu.filter(isUncertain).length : 0)

  let speaking = $state(false)

  function toggleSpeech() {
    if (!sentence) return
    if (speaking) {
      stopSpeech()
      speaking = false
    } else {
      speak(sentence.text, rate, voiceURI, () => (speaking = false))
      speaking = true
    }
  }

  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  async function copyShare() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(shareUrl)
      copied = true
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => (copied = false), 2000)
    } catch {
      // a failed copy must not keep showing a stale "copied!" from a prior success
      clearTimeout(copyTimer)
      copied = false
      window.prompt(t('shareButton'), shareUrl)
    }
  }
</script>

{#snippet shareButton()}
  <button aria-live="polite" onclick={copyShare}>
    {#if copied}{t('shareCopied')}
    {:else}<span class="emoji" aria-hidden="true">🔗</span> {t('shareButton')}{/if}
  </button>
{/snippet}

<aside class="inspector">
  {#if selected}
    <h2 lang="ja">
      {selected.surface}
      <button class="icon" disabled={!canSpeak} title={speakTitle} aria-label={t('speakBunsetsu')} onclick={() => speak(selected.surface, rate, voiceURI)}><span class="emoji" aria-hidden="true">🗣️</span></button>
    </h2>
    {@const label = confidenceLabel(selected)}
    {#if showConfidence && label}
      <p class="confidence" class:uncertain={isUncertain(selected)}>
        {t('attachment', { label })}
      </p>
    {/if}
    {#each selected.morphemes as m}
      {@const pg = posGloss(m.posJa, currentLocale())}
      <div class="morpheme">
        <div class="m-head">
          <span class="m-surface" lang="ja">{m.surface}</span>
          {#if m.reading && m.reading !== m.surface}<span class="m-reading" lang="ja">（{m.reading}）</span>{/if}
          {#if !m.posJa.startsWith('記号')}
            <button class="icon" disabled={!canSpeak} title={speakTitle} aria-label={t('speakItem', { surface: m.surface })} onclick={() => speak(m.surface, rate, voiceURI)}><span class="emoji" aria-hidden="true">🗣️</span></button>
          {/if}
        </div>
        <div class="m-pos"><span lang="ja">{m.posJa}</span>{#if pg}<span class="en">{pg}</span>{/if}</div>
        {#if m.baseForm}
          <div class="m-base">{t('baseForm')} <span lang="ja">{m.baseForm}</span></div>
        {/if}
        {#if m.conjugationJa}
          {@const cg = conjugationGloss(m.conjugationJa, currentLocale())}
          <div class="m-conj"><span lang="ja">{m.conjugationJa}</span>{#if cg}<span class="en">{cg}</span>{/if}</div>
        {/if}
        {#if m.jishoUrl}
          <a href={m.jishoUrl} target="_blank" rel="noopener">📖 Jisho</a>
        {/if}
      </div>
    {/each}
    <div class="actions">
      {@render shareButton()}
    </div>
  {:else}
    <h2>{total > 1 ? t('sentenceHeadingN', { index: index + 1, total }) : t('sentenceHeading')}</h2>
    {#if sentence}
      <p class="full-text" lang="ja">{sentence.text}</p>
      <div class="actions">
        <button disabled={!canSpeak} title={speakTitle} onclick={toggleSpeech}>
          {#if speaking}<span class="emoji" aria-hidden="true">⏹</span> {t('stopButton')}
          {:else}<span class="emoji" aria-hidden="true">🗣️</span> {t('speakButton')}{/if}
        </button>
        <a href={googleTranslateUrl(sentence.text, currentLocale())} target="_blank" rel="noopener">Google Translate ↗</a>
        {@render shareButton()}
      </div>
      {#if showConfidence && uncertainCount > 0}
        <p class="confidence-note">{t('uncertaintyNote', { uncertain: uncertainCount, total: sentence.bunsetsu.length - 1 })}</p>
      {/if}
    {:else}
      <p class="hint">{t('sentenceHint')}</p>
    {/if}
  {/if}
</aside>
