<script lang="ts">
  import SentenceInput from './SentenceInput.svelte'
  import Toolbar from './Toolbar.svelte'
  import LocaleSwitcher from './LocaleSwitcher.svelte'
  import SettingsMenu from './SettingsMenu.svelte'
  import HelpDialog from './HelpDialog.svelte'
  import SentenceCard from './SentenceCard.svelte'
  import Inspector from './Inspector.svelte'
  import { parseText, parserReady } from '../lib/parser'
  import { loadSettings, saveSettings, type ViewKind } from '../lib/settings'
  import { setStoredLocale, t } from '../lib/i18n.svelte'
  import { buildShareUrl, parseShareParams, type ShareParams } from '../lib/share'
  import type { ParsedSentence } from '../lib/types'
  import { tick } from 'svelte'

  const EXAMPLE = '昨日、私は友達と新しい映画を見に行きました。'

  let inputText = $state('')
  let parsedText = $state('')
  let sentences = $state<ParsedSentence[]>([])
  let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle')
  let errorMsg = $state('')
  let selection = $state<{ sentence: number; bunsetsu: number } | null>(null)
  let activeSentence = $state(0)

  const initialSettings = loadSettings()
  // apply the stored locale before the first render — the $effect below only
  // runs post-mount, which would flash the auto locale on first paint
  setStoredLocale(initialSettings.locale)
  let showFurigana = $state(initialSettings.showFurigana)
  let showConfidence = $state(initialSettings.showConfidence)
  let confidenceThreshold = $state(initialSettings.confidenceThreshold)
  let quietParts = $state(initialSettings.quietParts)
  let view = $state<ViewKind>(initialSettings.view)
  let rate = $state(initialSettings.rate)
  let voiceURI = $state(initialSettings.voiceURI)
  let locale = $state(initialSettings.locale)
  let chainColor = $state(initialSettings.chainColor)

  const shareParams = parseShareParams(location.search)
  const storedView = initialSettings.view
  let viewFromLink = $state(Boolean(shareParams?.view))
  let pendingJump: Pick<ShareParams, 'sentence' | 'bunsetsu'> | null = shareParams
    ? { sentence: shareParams.sentence, bunsetsu: shareParams.bunsetsu }
    : null
  let cardEls: HTMLElement[] = []

  if (shareParams) {
    inputText = shareParams.text
    if (shareParams.view) view = shareParams.view
    void handleParse()
  }

  $effect(() => {
    saveSettings({ showFurigana, showConfidence, confidenceThreshold, quietParts, view: viewFromLink ? storedView : view, rate, voiceURI, locale, chainColor })
  })

  $effect(() => {
    setStoredLocale(locale)
  })

  async function handleParse() {
    selection = null
    activeSentence = 0
    status = 'loading'
    try {
      sentences = await parseText(inputText)
      parsedText = inputText
      status = 'ready'
      await applyPendingJump()
    } catch (e) {
      // the jump is one-shot per boot: a failed share-link parse must not
      // apply a stale selection to whatever the user parses next
      pendingJump = null
      errorMsg = e instanceof Error ? e.message : String(e)
      status = 'error'
    }
  }

  /** one-shot: applies the share link's target after the first successful parse */
  async function applyPendingJump() {
    if (!pendingJump) return
    const { sentence: s, bunsetsu: b } = pendingJump
    pendingJump = null
    if (s === null || s >= sentences.length) return
    activeSentence = s
    if (b !== null && b < sentences[s].bunsetsu.length) selection = { sentence: s, bunsetsu: b }
    if (s > 0) {
      // the cards render only after the state flush — before tick(), cardEls is empty
      await tick()
      // optional call: jsdom has no scrollIntoView
      cardEls[s]?.scrollIntoView?.({ block: 'center' })
    }
  }

  function parseExample() {
    inputText = EXAMPLE
    void handleParse()
  }

  function select(sentence: number, bunsetsu: number) {
    activeSentence = sentence
    selection =
      selection?.sentence === sentence && selection.bunsetsu === bunsetsu ? null : { sentence, bunsetsu }
  }

  function activate(i: number) {
    activeSentence = i
    selection = null
  }

  const activeVM = $derived(sentences[activeSentence] ?? null)
  const selectedBunsetsu = $derived(
    selection ? (sentences[selection.sentence]?.bunsetsu[selection.bunsetsu] ?? null) : null,
  )
  const shareUrl = $derived(
    buildShareUrl(
      location.origin + location.pathname,
      parsedText,
      view,
      selection ? selection.sentence : activeSentence > 0 ? activeSentence : null,
      selection ? selection.bunsetsu : null,
    ),
  )
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') selection = null
  }}
/>

<div class="app">
  <header>
    <div class="brand">
      <h1><span lang="ja">文木</span> Ayaki</h1>
      <LocaleSwitcher bind:locale />
    </div>
    <Toolbar bind:showFurigana bind:view onviewclick={() => (viewFromLink = false)} />
    <HelpDialog {chainColor} />
    <SettingsMenu bind:rate bind:voiceURI bind:showConfidence bind:confidenceThreshold bind:quietParts bind:chainColor />
  </header>
  <main>
    <section class="content">
      <SentenceInput bind:text={inputText} busy={status === 'loading'} onparse={handleParse} />
      {#if status === 'idle'}
        <p class="hint">
          {t('idleHint')}
          <button class="linklike" data-testid="example-link" onclick={parseExample}>{t('exampleLink')}</button>
        </p>
      {:else if status === 'loading'}
        <p class="loading">
          {parserReady() ? t('loadingParse') : t('loadingDict')}
        </p>
      {:else if status === 'error'}
        <div class="error-banner">
          <p>{t('initError', { message: errorMsg })}</p>
          <button onclick={handleParse}>{t('retry')}</button>
        </div>
      {:else}
        {#each sentences as sentence, i (i)}
          <div class="card-slot" bind:this={cardEls[i]}>
            <SentenceCard
              {sentence}
              {view}
              {showFurigana}
              {showConfidence}
              {confidenceThreshold}
              {chainColor}
              active={sentences.length > 1 && activeSentence === i}
              selected={selection?.sentence === i ? selection.bunsetsu : null}
              onselect={(b) => select(i, b)}
              onactivate={() => activate(i)}
            />
          </div>
        {/each}
      {/if}
    </section>
    <Inspector sentence={activeVM} index={activeSentence} total={sentences.length} selected={selectedBunsetsu} {rate} {voiceURI} {showConfidence} {confidenceThreshold} {quietParts} {showFurigana} {shareUrl} />
  </main>
  <footer>
    <p>
      {t('footerParsing')} <a href="https://github.com/iatosh/sasara">sasara</a> (MIT) —
      {t('footerModel')} <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>,
      {t('footerDerived')} <a href="https://github.com/UniversalDependencies/UD_Japanese-GSD">UD Japanese-GSD</a> —
      {t('footerMorphology')} <a href="https://github.com/takuyaa/kuromoji.js">kuromoji.js</a> (Apache-2.0)
      {t('footerDict')}. {t('footerSelf')}
    </p>
  </footer>
</div>
