# Help Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A localized help dialog — opened from a "?" header button — explaining the app, the three views, and the diagram vocabulary, with a live interactive StairView demo.

**Architecture:** New `HelpDialog.svelte` on the native `<dialog>` element (showModal), embedding the existing `StairView` with a hardcoded 4-bunsetsu fixture (`src/lib/helpexample.ts`); 23 new catalog keys ×4 locales; a ninth live-check; all three README screenshots regenerated (header chrome changes).

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom), Playwright scripts.

**Spec:** `docs/superpowers/specs/2026-07-19-help-popup-design.md`

## Global Constraints

- The "?" button sits **between `Toolbar` and `SettingsMenu`** in the header; the gear stays rightmost. It reuses the existing `icon-button` class.
- The dialog is a native `<dialog>` opened with `showModal()`; close paths: × button, backdrop click (`e.target === dialog`), native Escape. The dialog element carries `onkeydown` stopping Escape propagation so App's `svelte:window` handler does not also clear the diagram selection (stopPropagation does not block the native cancel default action).
- The demo forces `showConfidence={true}` and falls back to amber when `chainColor === 'none'`: `demoChain = chainColor === 'none' ? 'amber' : chainColor`. Furigana stays off.
- Demo initial selection is bunsetsu 0 (新しい), reset to 0 on every open; clicking a selected bunsetsu clears the selection.
- Catalog values are copied VERBATIM from this plan's code blocks (they restate the spec's tables exactly). `MessageKey` derives from `en` (`keyof typeof en`); the `catalogs` constant in `src/lib/i18n.svelte.ts` enforces parity at compile time — a missing key in any locale is a type error.
- `settings.ts`, `chainpalette.ts`, `StairView.svelte` (and the other views), `Toolbar`, `SettingsMenu`, `Inspector` are NOT modified.
- README screenshots: the header gains a button → ALL THREE screenshots regenerate via `npm run shots` (standing rule).
- Test discipline: assertions never weakened; new tests only added, existing ones untouched except where a task explicitly says otherwise.
- Conventional Commits; the local git hook adds the Co-Authored-By trailer — do not add trailers manually.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: Demo fixture + locale catalogs

**Files:**
- Create: `src/lib/helpexample.ts`
- Modify: `src/lib/locales/en.ts`, `src/lib/locales/de.ts`, `src/lib/locales/ja.ts`, `src/lib/locales/zh.ts` (append 23 keys each)
- Test: existing `tests/lib/i18n.test.ts` parity coverage (no new test file)

**Interfaces:**
- Consumes: `BunsetsuVM` from `src/lib/types.ts`.
- Produces: `export const HELP_SENTENCE: BunsetsuVM[]` (4 entries, heads `[1, 2, 3, null]`, first probability `0.55`); catalog keys `helpLabel`, `helpClose`, `helpAboutTitle`, `helpAboutBody`, `helpViewsTitle`, `helpViewArcs`, `helpViewTree`, `helpViewStairs`, `helpDiagramTitle`, `helpDiagramHint`, `legendSelection`, `legendLink`, `legendChain`, `legendUncertain`, `legendChainNote`, `helpConfidenceTitle`, `helpConfidenceBody`, `helpTermTitle`, `helpTermBody`, `helpTipsTitle`, `helpTipSelect`, `helpTipHover`, `helpTipSpeak` — Task 2 renders all of them via `t()`.

- [ ] **Step 1: Create the fixture**

Create `src/lib/helpexample.ts` with exactly:

```ts
import type { BunsetsuVM } from './types'

/** canned sentence for the help dialog's live demo — never parsed at runtime */
export const HELP_SENTENCE: BunsetsuVM[] = [
  { index: 0, surface: '新しい', head: 1, probability: 0.55, forced: false, reading: 'あたらしい', morphemes: [] },
  { index: 1, surface: '映画を', head: 2, probability: 0.92, forced: false, reading: 'えいがを', morphemes: [] },
  { index: 2, surface: '見に', head: 3, probability: 0.97, forced: false, reading: 'みに', morphemes: [] },
  { index: 3, surface: '行きました。', head: null, probability: null, forced: false, reading: 'いきました。', morphemes: [] },
]
```

- [ ] **Step 2: Append the 23 keys to `en.ts`**

In `src/lib/locales/en.ts`, after the `footerSelf` line (still inside the object, before `} as const`), append:

```ts
  // help dialog
  helpLabel: 'help',
  helpClose: 'close help',
  helpAboutTitle: 'What is this?',
  helpAboutBody:
    'Ayaki (文木) visualizes the dependency structure of Japanese sentences: which phrase attaches to which. Each box is a bunsetsu (文節) — the small phrase unit Japanese sentences are chunked into: a content word as its head, followed by function elements such as particles, auxiliaries, or inflectional endings.',
  helpViewsTitle: 'The three views',
  helpViewArcs: 'Arcs — dependencies drawn as arches above the running sentence; good for seeing distance and nesting.',
  helpViewTree: 'Tree — the sentence as a branching hierarchy; good for seeing what groups under what.',
  helpViewStairs: 'CaboCha — the classic stair layout of Japanese NLP tools; each bunsetsu attaches to one further down.',
  helpDiagramTitle: 'Reading the diagram',
  helpDiagramHint: 'Try it — click any bunsetsu:',
  legendSelection: 'selected bunsetsu',
  legendLink: 'its attachment (the bunsetsu it modifies)',
  legendChain: 'the chain onward to the predicate',
  legendUncertain: 'uncertain attachment (dotted)',
  legendChainNote: 'The chain color — and whether it shows at all — is configurable in the settings.',
  helpConfidenceTitle: 'Attachment confidence',
  helpConfidenceBody:
    'The parse comes from a statistical model — it can be wrong. With "show attachment confidence" enabled, uncertain attachments are drawn dotted, and hovering a connector shows the model\'s probability, helping you stay critical of the analysis.',
  helpTermTitle: 'Predicate and head',
  helpTermBody:
    'Every chain ends at the sentence\'s predicate (述語) — the verb, adjective, or copula phrase that everything else ultimately attaches to. In linguistics this element is called the head (主辞) of the sentence.',
  helpTipsTitle: 'Tips',
  helpTipSelect: 'Click a bunsetsu to inspect it and trace its chain; click again or press Escape to clear.',
  helpTipHover: 'Hover a connector line to see its attachment probability.',
  helpTipSpeak: '🗣️ reads the sentence (or a single bunsetsu) aloud — voice and speed are in the settings.',
```

- [ ] **Step 3: Append the German values to `de.ts`**

Same position (end of the object), same key order:

```ts
  // help dialog
  helpLabel: 'Hilfe',
  helpClose: 'Hilfe schließen',
  helpAboutTitle: 'Worum geht es?',
  helpAboutBody:
    'Ayaki (文木) visualisiert die Dependenzstruktur japanischer Sätze: welche Phrase sich an welche anschließt. Jeder Kasten ist ein Bunsetsu (文節) — die kleine Phraseneinheit, in die japanische Sätze zerlegt werden: ein Inhaltswort als ihr Kopf, gefolgt von Funktionselementen wie Partikeln, Hilfsverben oder Flexionsendungen.',
  helpViewsTitle: 'Die drei Ansichten',
  helpViewArcs: 'Bögen — Abhängigkeiten als Bögen über dem laufenden Satz; gut, um Distanz und Verschachtelung zu sehen.',
  helpViewTree: 'Baum — der Satz als verzweigte Hierarchie; gut, um zu sehen, was sich wem unterordnet.',
  helpViewStairs: 'CaboCha — das klassische Treppenlayout japanischer NLP-Werkzeuge; jedes Bunsetsu schließt sich an ein weiter unten stehendes an.',
  helpDiagramTitle: 'Das Diagramm lesen',
  helpDiagramHint: 'Probieren Sie es aus — klicken Sie ein Bunsetsu an:',
  legendSelection: 'ausgewähltes Bunsetsu',
  legendLink: 'seine Anbindung (das Bunsetsu, das es modifiziert)',
  legendChain: 'die weitere Kette zum Prädikat',
  legendUncertain: 'unsichere Anbindung (gepunktet)',
  legendChainNote: 'Die Kettenfarbe — und ob sie überhaupt angezeigt wird — lässt sich in den Einstellungen anpassen.',
  helpConfidenceTitle: 'Anbindungskonfidenz',
  helpConfidenceBody:
    'Die Analyse stammt von einem statistischen Modell — sie kann falsch sein. Mit aktivierter Option „Zeige Anbindungskonfidenz“ werden unsichere Anbindungen gepunktet dargestellt, und beim Überfahren einer Verbindungslinie erscheint die Wahrscheinlichkeit des Modells — so bleiben Sie den Ergebnissen gegenüber kritisch.',
  helpTermTitle: 'Prädikat und Kopf',
  helpTermBody:
    'Jede Kette endet beim Prädikat (述語) des Satzes — der Verb-, Adjektiv- oder Kopulaphrase, an die sich letztlich alles anschließt. In der Linguistik heißt dieses Element auch der Kopf (主辞) des Satzes.',
  helpTipsTitle: 'Tipps',
  helpTipSelect: 'Klicken Sie ein Bunsetsu an, um es zu inspizieren und seine Kette zu verfolgen; erneutes Klicken oder Escape hebt die Auswahl auf.',
  helpTipHover: 'Fahren Sie über eine Verbindungslinie, um ihre Anbindungswahrscheinlichkeit zu sehen.',
  helpTipSpeak: '🗣️ liest den Satz (oder ein einzelnes Bunsetsu) vor — Stimme und Tempo finden Sie in den Einstellungen.',
```

- [ ] **Step 4: Append the Japanese values to `ja.ts`**

```ts
  // help dialog
  helpLabel: 'ヘルプ',
  helpClose: 'ヘルプを閉じる',
  helpAboutTitle: 'このアプリについて',
  helpAboutBody:
    '文木は日本語の文の係り受け構造(どの文節がどの文節に係るか)を可視化します。各ボックスは文節、つまり主辞となる内容語と、それに続く助詞・助動詞・活用語尾などの機能要素からなる、日本語の文を区切る基本単位です。',
  helpViewsTitle: '三つの表示',
  helpViewArcs: 'アーチ — 文の上に係り受けをアーチとして描きます。距離や入れ子構造が見やすい表示です。',
  helpViewTree: 'ツリー — 文を枝分かれする階層として描きます。何が何にまとまるかが見やすい表示です。',
  helpViewStairs: 'CaboCha — 日本語NLPツールで伝統的な階段状レイアウト。各文節は下方の文節に係ります。',
  helpDiagramTitle: '図の読み方',
  helpDiagramHint: '試してみましょう — 文節をクリック:',
  legendSelection: '選択中の文節',
  legendLink: '係り先(その文節が修飾する文節)',
  legendChain: '述語まで続く連鎖',
  legendUncertain: '不確かな係り受け(点線)',
  legendChainNote: '連鎖の色や表示の有無は設定で変更できます。',
  helpConfidenceTitle: '係り受けの信頼度',
  helpConfidenceBody:
    '解析は統計モデルによるもので、誤ることがあります。「係り受けの信頼度を表示」を有効にすると、不確かな係り受けが点線で描かれ、線にカーソルを合わせるとモデルの確率が表示されます。結果を鵜呑みにしないための手がかりです。',
  helpTermTitle: '述語と主辞',
  helpTermBody:
    'どの連鎖も文の述語 — 動詞・形容詞・コピュラなど、最終的にすべての文節が係っていく要素 — に行き着きます。言語学ではこの要素を主辞と呼びます。',
  helpTipsTitle: 'ヒント',
  helpTipSelect: '文節をクリックすると詳細と連鎖が表示されます。もう一度クリックするか Escape で解除します。',
  helpTipHover: '線にカーソルを合わせると係り受けの確率が表示されます。',
  helpTipSpeak: '🗣️ で文(または文節)を読み上げます。声と速さは設定で選べます。',
```

- [ ] **Step 5: Append the Chinese values to `zh.ts`**

```ts
  // help dialog
  helpLabel: '帮助',
  helpClose: '关闭帮助',
  helpAboutTitle: '关于本应用',
  helpAboutBody:
    '文木(Ayaki)可视化日语句子的依存结构:哪个短语依附于哪个短语。每个方框是一个文节(文節)——日语句子切分的基本短语单位:以一个实词为中心语,后接助词、助动词或活用词尾等功能成分。',
  helpViewsTitle: '三种视图',
  helpViewArcs: '弧线——在句子上方以弧线绘制依存关系,便于观察距离与嵌套。',
  helpViewTree: '树形——将句子绘制为分支层级,便于观察成分的归属。',
  helpViewStairs: 'CaboCha——日语NLP工具经典的阶梯布局,每个文节依附于其下方的文节。',
  helpDiagramTitle: '如何解读图示',
  helpDiagramHint: '试一试——点击任意文节:',
  legendSelection: '选中的文节',
  legendLink: '它的依附对象(该文节所修饰的文节)',
  legendChain: '一直延伸到谓语的依存链',
  legendUncertain: '不确定的依存(虚线)',
  legendChainNote: '依存链的颜色以及是否显示可在设置中调整。',
  helpConfidenceTitle: '依存置信度',
  helpConfidenceBody:
    '句法分析来自统计模型,可能出错。启用「显示依存置信度」后,不确定的依存关系以虚线绘制,将鼠标悬停在连线上可查看模型给出的概率,帮助你对分析结果保持审慎。',
  helpTermTitle: '谓语与中心语',
  helpTermBody:
    '每条依存链最终都汇聚到句子的谓语(述語)——动词、形容词或系词短语,其他成分最终都依附于它。在语言学中,这一成分称为句子的中心语(主辞)。',
  helpTipsTitle: '小提示',
  helpTipSelect: '点击文节可查看详情并追踪其依存链;再次点击或按 Escape 取消选择。',
  helpTipHover: '将鼠标悬停在连线上可查看依存概率。',
  helpTipSpeak: '🗣️ 可朗读整句(或单个文节)——语音和语速可在设置中调整。',
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run check`
Expected: all suites PASS (the existing i18n parity test now also covers the 23 new keys), svelte-check 0 errors 0 warnings. A missing/mistyped key in any locale fails `npm run check` at the `catalogs` constant.

- [ ] **Step 7: Commit**

```bash
git add src/lib/helpexample.ts src/lib/locales
git commit -m "feat: help catalog entries and demo sentence fixture"
```

---

### Task 2: HelpDialog component, styling, App wiring

**Files:**
- Create: `src/components/HelpDialog.svelte`
- Modify: `src/components/App.svelte` (import + one header line), `src/app.css` (append)
- Test: Create `tests/components/HelpDialog.test.ts`; modify `tests/components/App.test.ts` (add one wiring test — read the file first for its render/stub helpers)

**Interfaces:**
- Consumes: `HELP_SENTENCE` from `src/lib/helpexample.ts` (Task 1); `StairView` props `{ bunsetsu, showFurigana?, showConfidence?, selected?, chainColor?, onselect }`; `CHAIN_PALETTE`, `type ChainColor` from `src/lib/chainpalette.ts`; `t` from `src/lib/i18n.svelte.ts`.
- Produces: `HelpDialog` with props `{ chainColor?: ChainColor }` (plain, not bindable; default `'amber'`), rendered in App's header.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/HelpDialog.test.ts`:

```ts
// @vitest-environment jsdom
import { render, screen, fireEvent, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import HelpDialog from '../../src/components/HelpDialog.svelte'

// jsdom gained <dialog> showModal/close in recent versions; polyfill minimally
// if this environment lacks them so the suite doesn't hard-crash
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

function getDialog(): HTMLDialogElement {
  const d = document.querySelector('dialog.help-dialog')
  if (!d) throw new Error('help dialog not rendered')
  return d as HTMLDialogElement
}

describe('HelpDialog', () => {
  it('renders the trigger and opens a dialog with all six sections', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    const trigger = screen.getByRole('button', { name: 'help' })
    expect(getDialog().open).toBe(false)
    await user.click(trigger)
    const dialog = getDialog()
    expect(dialog.open).toBe(true)
    const headings = within(dialog).getAllByRole('heading', { level: 3 })
    expect(headings.map((h) => h.textContent)).toEqual([
      'What is this?',
      'The three views',
      'Reading the diagram',
      'Attachment confidence',
      'Predicate and head',
      'Tips',
    ])
  })

  it('shows the live demo: 4 bunsetsu, 新しい preselected, chain traced, dotted uncertainty', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const boxes = document.querySelectorAll('dialog g.bunsetsu')
    expect(boxes).toHaveLength(4)
    expect(boxes[0].classList.contains('selected')).toBe(true)
    const chained = [...document.querySelectorAll('dialog g.bunsetsu.chain')]
    expect(chained.map((g) => g.getAttribute('aria-label'))).toEqual(['見に', '行きました。'])
    expect(document.querySelectorAll('dialog path.arc.chain')).toHaveLength(2)
    // P = 0.55 on 新しい → its connector is dotted (showConfidence forced on)
    expect(document.querySelectorAll('dialog path.arc.low')).toHaveLength(1)
  })

  it('lets the reader move and clear the demo selection', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const boxes = document.querySelectorAll('dialog g.bunsetsu')
    await user.click(boxes[1]) // 映画を
    expect(boxes[1].classList.contains('selected')).toBe(true)
    expect(boxes[0].classList.contains('selected')).toBe(false)
    expect([...document.querySelectorAll('dialog g.bunsetsu.chain')].map((g) => g.getAttribute('aria-label'))).toEqual([
      '行きました。',
    ])
    await user.click(boxes[1]) // re-click clears
    expect(document.querySelector('dialog g.bunsetsu.selected')).toBeNull()
    expect(document.querySelector('dialog g.bunsetsu.chain')).toBeNull()
  })

  it('falls back to amber when the configured chain color is none', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'none' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const svg = document.querySelector('dialog svg.stairview')
    expect(svg?.getAttribute('style') ?? '').toContain('#b07a2a')
  })

  it('closes via the close button and via backdrop click', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    await user.click(screen.getByRole('button', { name: 'close help' }))
    expect(getDialog().open).toBe(false)
    await user.click(screen.getByRole('button', { name: 'help' }))
    await fireEvent.click(getDialog()) // backdrop: target is the dialog element itself
    expect(getDialog().open).toBe(false)
  })

  it('stops Escape from reaching document-level listeners', async () => {
    const docListener = vi.fn()
    document.addEventListener('keydown', docListener)
    try {
      const user = userEvent.setup()
      render(HelpDialog, { props: { chainColor: 'amber' } })
      await user.click(screen.getByRole('button', { name: 'help' }))
      await fireEvent.keyDown(getDialog(), { key: 'Escape' })
      expect(docListener).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', docListener)
    }
  })

  it('resets the demo selection to 新しい on every open', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const boxes = document.querySelectorAll('dialog g.bunsetsu')
    await user.click(boxes[2])
    await user.click(screen.getByRole('button', { name: 'close help' }))
    await user.click(screen.getByRole('button', { name: 'help' }))
    expect(boxes[0].classList.contains('selected')).toBe(true)
  })
})
```

In `tests/components/App.test.ts` (read the file first; reuse its existing render helper / global stubs), add ONE test alongside the other header tests:

```ts
it('exposes the help button in the header and opens the help dialog', async () => {
  const user = userEvent.setup()
  render(App)
  await user.click(screen.getByRole('button', { name: 'help' }))
  const dialog = document.querySelector('dialog.help-dialog') as HTMLDialogElement
  expect(dialog.open).toBe(true)
})
```

(If App tests need the dialog polyfill too, hoist the same `beforeAll` block there.)

Run: `npx vitest run tests/components/HelpDialog.test.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 2: Create `src/components/HelpDialog.svelte`**

```svelte
<script lang="ts">
  import StairView from './StairView.svelte'
  import { HELP_SENTENCE } from '../lib/helpexample'
  import { t } from '../lib/i18n.svelte'
  import { CHAIN_PALETTE, type ChainColor } from '../lib/chainpalette'

  let { chainColor = 'amber' }: { chainColor?: ChainColor } = $props()

  const uid = $props.id()
  let dialog = $state<HTMLDialogElement>()
  let demoSelected = $state<number | null>(0)

  // the demo must always show a chain — fall back to amber when disabled
  const demoChain = $derived(chainColor === 'none' ? 'amber' : chainColor)
  const demoPalette = $derived(CHAIN_PALETTE[demoChain])

  function open() {
    demoSelected = 0
    dialog?.showModal()
  }
</script>

<button
  class="icon-button"
  aria-label={t('helpLabel')}
  title={t('helpLabel')}
  aria-haspopup="dialog"
  onclick={open}
>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
</button>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="help-dialog"
  bind:this={dialog}
  aria-labelledby="help-title-{uid}"
  onclick={(e) => {
    // only the backdrop has the dialog itself as target — .help-body fills the frame
    if (e.target === dialog) dialog?.close()
  }}
  onkeydown={(e) => {
    // the native cancel (a default action) still closes the dialog; this only
    // keeps App's window-level Escape handler from clearing the selection too
    if (e.key === 'Escape') e.stopPropagation()
  }}
>
  <div class="help-body">
    <header class="help-header">
      <h2 id="help-title-{uid}">{t('helpLabel')}</h2>
      <button class="icon-button" aria-label={t('helpClose')} onclick={() => dialog?.close()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </header>
    <section>
      <h3>{t('helpAboutTitle')}</h3>
      <p>{t('helpAboutBody')}</p>
    </section>
    <section>
      <h3>{t('helpViewsTitle')}</h3>
      <ul>
        <li>{t('helpViewArcs')}</li>
        <li>{t('helpViewTree')}</li>
        <li>{t('helpViewStairs')}</li>
      </ul>
    </section>
    <section>
      <h3>{t('helpDiagramTitle')}</h3>
      <p>{t('helpDiagramHint')}</p>
      <div class="help-demo">
        <StairView
          bunsetsu={HELP_SENTENCE}
          showConfidence={true}
          selected={demoSelected}
          chainColor={demoChain}
          onselect={(i) => (demoSelected = demoSelected === i ? null : i)}
        />
      </div>
      <ul class="help-legend">
        <li><span class="legend-swatch legend-selected" aria-hidden="true"></span>{t('legendSelection')}</li>
        <li><span class="legend-swatch legend-link" aria-hidden="true"></span>{t('legendLink')}</li>
        <li>
          <span
            class="legend-swatch legend-chain"
            style="--sw: {demoPalette.line}; --sw-soft: {demoPalette.soft}"
            aria-hidden="true"
          ></span>{t('legendChain')}
        </li>
        <li><span class="legend-line" aria-hidden="true"></span>{t('legendUncertain')}</li>
      </ul>
      <p class="help-note">{t('legendChainNote')}</p>
    </section>
    <section>
      <h3>{t('helpConfidenceTitle')}</h3>
      <p>{t('helpConfidenceBody')}</p>
    </section>
    <section>
      <h3>{t('helpTermTitle')}</h3>
      <p>{t('helpTermBody')}</p>
    </section>
    <section>
      <h3>{t('helpTipsTitle')}</h3>
      <ul>
        <li>{t('helpTipSelect')}</li>
        <li>{t('helpTipHover')}</li>
        <li>{t('helpTipSpeak')}</li>
      </ul>
    </section>
  </div>
</dialog>
```

(If svelte-check does not flag the dialog's handlers, drop the `svelte-ignore` comment; if it flags different rule names, use those. Report which in the task report.)

- [ ] **Step 3: Wire into `App.svelte`**

Add the import next to the other component imports:

```ts
import HelpDialog from './HelpDialog.svelte'
```

and in the header, between `Toolbar` and `SettingsMenu`:

```svelte
<Toolbar bind:showFurigana bind:view />
<HelpDialog {chainColor} />
<SettingsMenu bind:rate bind:voiceURI bind:showConfidence bind:chainColor />
```

- [ ] **Step 4: Append the dialog CSS to `src/app.css`**

After the swatch rules (end of the settings-popup block), append:

```css
/* help dialog */
.help-dialog { border: none; border-radius: 12px; padding: 0; max-width: 640px; width: calc(100vw - 2rem); max-height: 85vh; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); }
.help-dialog::backdrop { background: rgba(15, 23, 42, 0.4); }
.help-body { padding: 1rem 1.5rem 1.5rem; max-height: 85vh; overflow-y: auto; box-sizing: border-box; }
.help-header { display: flex; align-items: center; justify-content: space-between; }
.help-header h2 { margin: 0; font-size: 1.15rem; text-transform: capitalize; }
.help-body section { margin-top: 0.9rem; }
.help-body h3 { margin: 0 0 0.3rem; font-size: 0.95rem; }
.help-body p, .help-body li { font-size: 0.9rem; line-height: 1.5; margin: 0.2rem 0; }
.help-body ul { margin: 0.2rem 0; padding-left: 1.2rem; }
.help-demo { margin: 0.5rem 0; }
.help-legend { list-style: none; padding: 0; }
.help-legend li { display: flex; align-items: center; gap: 0.5rem; }
.legend-swatch { flex: none; width: 14px; height: 14px; border-radius: 4px; }
.legend-selected { background: var(--accent); }
.legend-link { background: #eef2f8; border: 2px solid var(--accent); }
.legend-chain { background: var(--sw-soft); border: 2px solid var(--sw); }
.legend-line { flex: none; width: 18px; border-top: 2px dotted var(--uncertain-line); }
.help-note { color: #57606a; font-size: 0.8rem; font-style: italic; }
```

- [ ] **Step 5: Run the affected suites, then the full check**

Run: `npx vitest run tests/components/HelpDialog.test.ts tests/components/App.test.ts`
Expected: PASS.
Then: `npm test && npm run check`
Expected: all PASS, 0 errors 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/HelpDialog.svelte src/components/App.svelte src/app.css tests/components/HelpDialog.test.ts tests/components/App.test.ts
git commit -m "feat: help dialog with live diagram demo and legend"
```

---

### Task 3: Live-check help probe + README screenshots

**Files:**
- Modify: `scripts/live-check.mjs` (one new check); regenerate `docs/images/screenshot.png`, `docs/images/screenshot-tree.png`, `docs/images/screenshot-cabocha.png` via `npm run shots` (do not edit README text)

**Interfaces:**
- Consumes: the deployed/preview app's help button (accessible name `help` — the script pins locale en-US) and `dialog.help-dialog` markup from Task 2.
- Produces: live-check reports 9 checks; three regenerated screenshot PNGs.

- [ ] **Step 1: Add the ninth check**

In `scripts/live-check.mjs`, inside the `if (booted) { … }` block, directly after the locale try/catch, add:

```js
    try {
      await page.getByRole('button', { name: 'help' }).click()
      await page.waitForSelector('dialog.help-dialog[open]', { timeout: 5_000 })
      const demoBoxes = await page.locator('dialog.help-dialog g.bunsetsu').count()
      if (demoBoxes !== 4) throw new Error(`demo bunsetsu: ${demoBoxes}`)
      await page.getByRole('button', { name: 'close help' }).click()
      await page.waitForSelector('dialog.help-dialog[open]', { state: 'hidden', timeout: 5_000 })
      ok('help: dialog opens with 4-bunsetsu demo and closes')
    } catch (e) {
      fail('help', String(e))
    }
```

- [ ] **Step 2: Verify the check against a local preview**

```bash
npm run build
npx vite preview --base=/ayaki/ --port 4174 &
npm run live-check -- http://localhost:4174/ayaki/
kill %1
```

Expected: `ok help: dialog opens with 4-bunsetsu demo and closes` among 9 ok lines, `live-check passed`. (The parse check downloads the ~4 MB dictionary — allow the 60 s timeout.)

- [ ] **Step 3: Regenerate ALL three README screenshots**

Run: `npm run shots`
Expected: the script builds and rewrites all three PNGs. Verify with `git status` that all three changed, and visually confirm (open one PNG) that the header now shows the "?" button between the view controls and the gear.

- [ ] **Step 4: Full gates**

Run: `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add scripts/live-check.mjs docs/images
git commit -m "feat: live-check help probe, refresh README screenshots for help button"
```
