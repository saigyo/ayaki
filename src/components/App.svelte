<script lang="ts">
  import SentenceInput from './SentenceInput.svelte'
  import Toolbar from './Toolbar.svelte'
  import SentenceCard from './SentenceCard.svelte'
  import Inspector from './Inspector.svelte'
  import { parseText, parserReady } from '../lib/parser'
  import type { ParsedSentence } from '../lib/types'

  const EXAMPLE = '昨日、私は友達と新しい映画を見に行きました。'

  let inputText = $state('')
  let sentences = $state<ParsedSentence[]>([])
  let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle')
  let errorMsg = $state('')
  let selection = $state<{ sentence: number; bunsetsu: number } | null>(null)
  let activeSentence = $state(0)
  let showFurigana = $state(false)
  let view = $state<'arcs' | 'tree'>('arcs')
  let rate = $state(1)

  async function handleParse() {
    selection = null
    activeSentence = 0
    status = 'loading'
    try {
      sentences = await parseText(inputText)
      status = 'ready'
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e)
      status = 'error'
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
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') selection = null
  }}
/>

<div class="app">
  <header>
    <h1><span lang="ja">文木</span> Ayaki</h1>
    <Toolbar bind:showFurigana bind:view bind:rate />
  </header>
  <main>
    <section class="content">
      <SentenceInput bind:text={inputText} busy={status === 'loading'} onparse={handleParse} />
      {#if status === 'idle'}
        <p class="hint">
          Enter a Japanese sentence and press 解析 —
          <button class="linklike" onclick={parseExample}>例文で試してみる (try the example)</button>
        </p>
      {:else if status === 'loading'}
        <p class="loading">
          {parserReady() ? '解析中… parsing…' : '辞書を読み込んでいます… loading dictionary (~4 MB, first time only)…'}
        </p>
      {:else if status === 'error'}
        <div class="error-banner">
          <p>Could not initialize the parser: {errorMsg}</p>
          <button onclick={handleParse}>Retry</button>
        </div>
      {:else}
        {#each sentences as sentence, i (i)}
          <SentenceCard
            {sentence}
            {view}
            {showFurigana}
            active={sentences.length > 1 && activeSentence === i}
            selected={selection?.sentence === i ? selection.bunsetsu : null}
            onselect={(b) => select(i, b)}
            onactivate={() => activate(i)}
          />
        {/each}
      {/if}
    </section>
    <Inspector sentence={activeVM} index={activeSentence} total={sentences.length} selected={selectedBunsetsu} {rate} />
  </main>
  <footer>
    <p>
      Parsing by <a href="https://github.com/iatosh/sasara">sasara</a> (MIT) — model
      <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, derived from
      <a href="https://github.com/UniversalDependencies/UD_Japanese-GSD">UD Japanese-GSD</a> —
      morphology by <a href="https://github.com/takuyaa/kuromoji.js">kuromoji.js</a> (Apache-2.0)
      with the IPAdic dictionary (IPADIC license). Ayaki itself is MIT.
    </p>
  </footer>
</div>
