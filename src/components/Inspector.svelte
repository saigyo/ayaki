<script lang="ts">
  import { onMount } from 'svelte'
  import { googleTranslateUrl } from '../lib/links'
  import { speak, speechAvailable, stopSpeech } from '../lib/speech'
  import { confidenceLabel, isUncertain } from '../lib/viewmodel'
  import { currentLocale } from '../lib/i18n.svelte'
  import { conjugationGloss, posGloss } from '../lib/pos'
  import type { BunsetsuVM, ParsedSentence } from '../lib/types'

  let {
    sentence,
    index,
    total,
    selected,
    rate,
    voiceURI,
  }: {
    sentence: ParsedSentence | null
    index: number
    total: number
    selected: BunsetsuVM | null
    rate: number
    voiceURI: string | null
  } = $props()

  let canSpeak = $state(false)
  onMount(() => {
    const update = () => (canSpeak = speechAvailable())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const speakTitle = $derived(canSpeak ? 'Speak with Web Speech' : 'No Japanese voice available in this browser')
  const uncertainCount = $derived(sentence ? sentence.bunsetsu.filter(isUncertain).length : 0)
</script>

<aside class="inspector">
  {#if selected}
    <h2 lang="ja">
      {selected.surface}
      <button class="icon" disabled={!canSpeak} title={speakTitle} aria-label="speak bunsetsu" onclick={() => speak(selected.surface, rate, voiceURI)}>🔊</button>
    </h2>
    {@const label = confidenceLabel(selected)}
    {#if label}
      <p class="confidence" class:uncertain={isUncertain(selected)}>
        attachment: {label}
      </p>
    {/if}
    {#each selected.morphemes as m}
      {@const pg = posGloss(m.posJa, currentLocale())}
      <div class="morpheme">
        <div class="m-head">
          <span class="m-surface" lang="ja">{m.surface}</span>
          {#if m.reading && m.reading !== m.surface}<span class="m-reading" lang="ja">（{m.reading}）</span>{/if}
          <button class="icon" disabled={!canSpeak} title={speakTitle} aria-label={'speak ' + m.surface} onclick={() => speak(m.surface, rate, voiceURI)}>🔊</button>
        </div>
        <div class="m-pos"><span lang="ja">{m.posJa}</span>{#if pg}<span class="en">{pg}</span>{/if}</div>
        {#if m.baseForm}
          <div class="m-base">base form: <span lang="ja">{m.baseForm}</span></div>
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
  {:else}
    <h2>{total > 1 ? `Sentence ${index + 1} / ${total}` : 'Sentence'}</h2>
    {#if sentence}
      <p class="full-text" lang="ja">{sentence.text}</p>
      <div class="actions">
        <button disabled={!canSpeak} title={speakTitle} onclick={() => speak(sentence.text, rate, voiceURI)}>🔊 Speak</button>
        <button onclick={stopSpeech}>⏹ Stop</button>
        <a href={googleTranslateUrl(sentence.text)} target="_blank" rel="noopener">Google Translate ↗</a>
      </div>
      {#if uncertainCount > 0}
        <p class="confidence-note">{uncertainCount} of {sentence.bunsetsu.length - 1} attachments uncertain</p>
      {/if}
    {:else}
      <p class="hint">Parse a sentence, then click a part of it to inspect readings and parts of speech.</p>
    {/if}
  {/if}
</aside>
