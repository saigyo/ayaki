<script lang="ts">
  import { onMount } from 'svelte'
  import { googleTranslateUrl } from '../lib/links'
  import { speak, speechAvailable, stopSpeech } from '../lib/speech'
  import { confidenceLabel, isUncertain, LOW_CONFIDENCE } from '../lib/viewmodel'
  import { currentLocale, t } from '../lib/i18n.svelte'
  import { conjugationGloss, posGloss } from '../lib/pos'
  import type { BunsetsuVM, ParsedSentence } from '../lib/types'
  import SegmentedSurface from './SegmentedSurface.svelte'
  import { morphemeRole, PART_PALETTE } from '../lib/partroles'

  let {
    sentence,
    index,
    total,
    selected,
    rate,
    voiceURI,
    showConfidence = false,
    confidenceThreshold = LOW_CONFIDENCE,
    quietParts = false,
    shareUrl = '',
  }: {
    sentence: ParsedSentence | null
    index: number
    total: number
    selected: BunsetsuVM | null
    rate: number
    voiceURI: string | null
    showConfidence?: boolean
    confidenceThreshold?: number
    quietParts?: boolean
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
  const uncertainCount = $derived(sentence ? sentence.bunsetsu.filter((b) => isUncertain(b, confidenceThreshold)).length : 0)

  let speaking = $state(false)
  // bumped on every toggle transition: a completion callback from a superseded
  // utterance (its end fires asynchronously after cancel) must not flip the state
  let speakGen = 0

  let hoverPart = $state<number | null>(null)
  let entryEls: HTMLElement[] = []

  // switching bunsetsu must not carry a stale highlight over
  $effect(() => {
    void selected
    hoverPart = null
  })

  function hoverSegment(i: number | null) {
    hoverPart = i
    if (i !== null) entryEls[i]?.scrollIntoView({ block: 'nearest' })
  }

  function toggleSpeech() {
    if (!sentence) return
    if (speaking) {
      speakGen++
      stopSpeech()
      speaking = false
    } else {
      const gen = ++speakGen
      speak(sentence.text, rate, voiceURI, () => {
        if (gen === speakGen) speaking = false
      })
      speaking = true
    }
  }

  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  // mirrors speakGen: a writeText that resolves after the card switched away
  // must not flip "copied!" onto the other card's button
  let copyGen = 0

  // "copied!" is a claim about the CURRENT share url — any change (card switch,
  // sentence switch, view switch) invalidates it and voids in-flight copies
  $effect(() => {
    void shareUrl
    copyGen++
    clearTimeout(copyTimer)
    copied = false
  })

  async function copyShare() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      const gen = ++copyGen
      await navigator.clipboard.writeText(shareUrl)
      if (gen !== copyGen) return
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
      <SegmentedSurface morphemes={selected.morphemes} quiet={quietParts} active={hoverPart} onhover={hoverSegment} />
      <button class="icon" disabled={!canSpeak} title={speakTitle} aria-label={t('speakBunsetsu')} onclick={() => speak(selected.surface, rate, voiceURI)}><span class="emoji" aria-hidden="true">🗣️</span></button>
    </h2>
    {@const label = confidenceLabel(selected)}
    {#if showConfidence && label}
      <p class="confidence" class:uncertain={isUncertain(selected, confidenceThreshold)}>
        {t('attachment', { label })}
      </p>
    {/if}
    {#each selected.morphemes as m, mi}
      {@const pg = posGloss(m.posJa, currentLocale())}
      <!-- Pointer-only hover affordance: keyboard focus reaching the entry's own
           speak button or Jisho link triggers the same styling via :focus-within,
           so making the div itself focusable would only add a dead tab stop. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="morpheme"
        class:active={hoverPart === mi}
        class:quiet={quietParts}
        style="--part: {PART_PALETTE[morphemeRole(m.posJa)]}"
        bind:this={entryEls[mi]}
        onmouseenter={() => (hoverPart = mi)}
        onfocusin={() => (hoverPart = mi)}
        onfocusout={() => (hoverPart = null)}
        onmouseleave={() => (hoverPart = null)}
      >
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
        <button disabled={!canSpeak && !speaking} title={speaking ? t('speakTitle') : speakTitle} onclick={toggleSpeech}>
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
