<script lang="ts">
  import { onMount } from 'svelte'
  import { googleTranslateUrl } from '../lib/links'
  import { speak, speechAvailable, stopSpeech } from '../lib/speech'
  import { isUncertain } from '../lib/viewmodel'
  import type { BunsetsuVM, ParsedSentence } from '../lib/types'

  let {
    fullText,
    sentences,
    selected,
    rate,
  }: {
    fullText: string
    sentences: ParsedSentence[]
    selected: BunsetsuVM | null
    rate: number
  } = $props()

  let canSpeak = $state(false)
  onMount(() => {
    const update = () => (canSpeak = speechAvailable())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const speakTitle = $derived(canSpeak ? 'Speak with Web Speech' : 'No Japanese voice available in this browser')
</script>

<aside class="inspector">
  {#if selected}
    <h2 lang="ja">
      {selected.surface}
      <button class="icon" disabled={!canSpeak} title={speakTitle} aria-label="speak bunsetsu" onclick={() => speak(selected.surface, rate)}>🔊</button>
    </h2>
    {#if selected.probability !== null}
      <p class="confidence" class:uncertain={isUncertain(selected)}>
        attachment confidence: {Math.round(selected.probability * 100)}%{selected.forced ? ' (forced)' : ''}
      </p>
    {/if}
    {#each selected.morphemes as m (m.surface + m.posJa)}
      <div class="morpheme">
        <div class="m-head">
          <span class="m-surface" lang="ja">{m.surface}</span>
          {#if m.reading && m.reading !== m.surface}<span class="m-reading" lang="ja">（{m.reading}）</span>{/if}
          <button class="icon" disabled={!canSpeak} title={speakTitle} aria-label="speak morpheme" onclick={() => speak(m.surface, rate)}>🔊</button>
        </div>
        <div class="m-pos"><span lang="ja">{m.posJa}</span>{#if m.posEn}<span class="en">{m.posEn}</span>{/if}</div>
        {#if m.baseForm}
          <div class="m-base">base form: <span lang="ja">{m.baseForm}</span></div>
        {/if}
        {#if m.conjugationJa}
          <div class="m-conj"><span lang="ja">{m.conjugationJa}</span>{#if m.conjugationEn}<span class="en">{m.conjugationEn}</span>{/if}</div>
        {/if}
        {#if m.jishoUrl}
          <a href={m.jishoUrl} target="_blank" rel="noopener">📖 Jisho</a>
        {/if}
      </div>
    {/each}
  {:else}
    <h2>Sentence</h2>
    {#if fullText}
      <p class="full-text" lang="ja">{fullText}</p>
      <div class="actions">
        <button disabled={!canSpeak} title={speakTitle} onclick={() => speak(fullText, rate)}>🔊 Speak</button>
        <button onclick={stopSpeech}>⏹ Stop</button>
        <a href={googleTranslateUrl(fullText)} target="_blank" rel="noopener">Google Translate ↗</a>
      </div>
      {#each sentences as s, i (i)}
        {@const uncertain = s.bunsetsu.filter(isUncertain).length}
        {#if uncertain > 0}
          <p class="confidence-note">Sentence {i + 1}: {uncertain} of {s.bunsetsu.length - 1} attachments uncertain</p>
        {/if}
      {/each}
    {:else}
      <p class="hint">Parse a sentence, then click a part of it to inspect readings and parts of speech.</p>
    {/if}
  {/if}
</aside>
