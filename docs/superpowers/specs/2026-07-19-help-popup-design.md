# Help Popup — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

The app's visual vocabulary has grown rich enough to confuse a first-time
visitor: selection blue, immediate-link highlight, the chain-to-predicate
trace in a configurable color, and the optional dotted uncertainty styling
all coexist. A help popup explains the app, the views, and how to decode
the diagrams — opened from a "?" button in the header, localized ×4 like
everything else.

## Shell — `HelpDialog.svelte`

A new component rendered in the header **between `Toolbar` and
`SettingsMenu`** (the gear keeps its rightmost spot):

```svelte
<Toolbar bind:showFurigana bind:view />
<HelpDialog {chainColor} />
<SettingsMenu bind:rate bind:voiceURI bind:showConfidence bind:chainColor />
```

- The trigger is a "?" button styled with the same class as the gear
  button, `aria-label={t('helpLabel')}` and `title={t('helpLabel')}`.
- The popup itself is a native `<dialog>` opened with `showModal()` —
  focus trap, Escape-to-close, and focus-return to the trigger come free.
- `bind:this={dialog}`; the trigger's click handler calls
  `dialog?.showModal()` and resets the demo selection to `0`.
- Close paths:
  - an "×" button (`aria-label={t('helpClose')}`) calling `dialog.close()`;
  - **backdrop click**: `onclick` on the dialog element closing when
    `e.target === dialog` (an inner `.help-body` wrapper fills the dialog,
    so content clicks never match);
  - **Escape**: handled natively via the dialog's default cancel behavior.
    Additionally the dialog element gets
    `onkeydown={(e) => { if (e.key === 'Escape') e.stopPropagation() }}` so
    App's `svelte:window` Escape handler does not also clear the main
    diagram selection behind the modal (stopPropagation does not block the
    native cancel — it is a default action, not a bubbling listener).
- Dialog a11y: `aria-labelledby` pointing at the `<h2>` title (which reuses
  `t('helpLabel')`).
- Sizing: `max-width: 640px`, `max-height: 85vh`, scrollable body, dimmed
  `::backdrop`.

Props: `{ chainColor }: { chainColor: ChainColor }` — read-only (not
bindable).

## Live demo diagram

The centerpiece of the "Reading the diagram" section is the **real
`StairView`** rendering a canned sentence — the exact scene from the chain
brainstorm mockups:

```
新しい → 映画を → 見に → 行きました。
```

### Fixture — `src/lib/helpexample.ts`

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

`probability: 0.55` on the first bunsetsu makes its connector render dotted
(the `low` class) — the uncertainty styling is demonstrably present.
`morphemes: []` is fine: the demo never opens the Inspector. The fixture is
hardcoded so help opens instantly, before the dictionary loads.

### Embedding

```svelte
<StairView
  bunsetsu={HELP_SENTENCE}
  showConfidence={true}
  selected={demoSelected}
  chainColor={demoChain}
  onselect={(i) => (demoSelected = demoSelected === i ? null : i)}
/>
```

- `demoSelected` starts at `0` (新しい selected: selection + immediate link
  + a two-link chain are all visible at once) and is reset to `0` every
  time the dialog opens. Fully interactive — readers click bunsetsu and
  watch the chain retrace.
- `showConfidence` is forced on in the demo regardless of the user's
  setting — the legend explains the dotted style, so it must be visible.
- Furigana stays off in the demo for clarity.
- **Chain color fallback:** `const demoChain = $derived(chainColor ===
  'none' ? 'amber' : chainColor)` — the demo respects the user's configured
  color but must always show a chain; the legend notes the color (and
  whether the chain shows at all) is configurable in settings.

### Legend

Below the demo, a list of four items, each with a small inline swatch
(reusing the app's real colors so the legend can never drift):

| item | swatch styling |
| --- | --- |
| `legendSelection` | filled square `background: var(--accent)` |
| `legendLink` | square `background: #eef2f8; border: 2px solid var(--accent)` (the highlighted-box look) |
| `legendChain` | square `background: CHAIN_PALETTE[demoChain].soft; border: 2px solid CHAIN_PALETTE[demoChain].line` (same miniature as the settings swatches, follows the demo color) |
| `legendUncertain` | short line `border-top: 2px dotted var(--uncertain-line)` |

Plus `legendChainNote` in muted small text after the legend.

## Content — six sections

Structure inside `.help-body`: `<h2>` title, then per section `<h3>` +
body. Sections 2 and 6 are `<ul>` lists; section 3 is hint + demo + legend.

### Locale catalog — 23 new keys, exact values

| key | en |
| --- | --- |
| `helpLabel` | help |
| `helpClose` | close help |
| `helpAboutTitle` | What is this? |
| `helpAboutBody` | Ayaki (文木) visualizes the dependency structure of Japanese sentences: which phrase attaches to which. Each box is a bunsetsu (文節) — the small phrase unit Japanese sentences are chunked into: a content word as its head, followed by function elements such as particles, auxiliaries, or inflectional endings. |
| `helpViewsTitle` | The three views |
| `helpViewArcs` | Arcs — dependencies drawn as arches above the running sentence; good for seeing distance and nesting. |
| `helpViewTree` | Tree — the sentence as a branching hierarchy; good for seeing what groups under what. |
| `helpViewStairs` | CaboCha — the classic stair layout of Japanese NLP tools; each bunsetsu attaches to one further down. |
| `helpDiagramTitle` | Reading the diagram |
| `helpDiagramHint` | Try it — click any bunsetsu: |
| `legendSelection` | selected bunsetsu |
| `legendLink` | its attachment (the bunsetsu it modifies) |
| `legendChain` | the chain onward to the predicate |
| `legendUncertain` | uncertain attachment (dotted) |
| `legendChainNote` | The chain color — and whether it shows at all — is configurable in the settings. |
| `helpConfidenceTitle` | Attachment confidence |
| `helpConfidenceBody` | The parse comes from a statistical model — it can be wrong. With "show attachment confidence" enabled, uncertain attachments are drawn dotted, and hovering a connector shows the model's probability, helping you stay critical of the analysis. |
| `helpTermTitle` | Predicate and head |
| `helpTermBody` | Every chain ends at the sentence's predicate (述語) — the verb, adjective, or copula phrase that everything else ultimately attaches to. In linguistics this element is called the head (主辞) of the sentence. |
| `helpTipsTitle` | Tips |
| `helpTipSelect` | Click a bunsetsu to inspect it and trace its chain; click again or press Escape to clear. |
| `helpTipHover` | Hover a connector line to see its attachment probability. |
| `helpTipSpeak` | 🗣️ reads the sentence (or a single bunsetsu) aloud — voice and speed are in the settings. |

| key | de |
| --- | --- |
| `helpLabel` | Hilfe |
| `helpClose` | Hilfe schließen |
| `helpAboutTitle` | Worum geht es? |
| `helpAboutBody` | Ayaki (文木) visualisiert die Dependenzstruktur japanischer Sätze: welche Phrase sich an welche anschließt. Jeder Kasten ist ein Bunsetsu (文節) — die kleine Phraseneinheit, in die japanische Sätze zerlegt werden: ein Inhaltswort als ihr Kopf, gefolgt von Funktionselementen wie Partikeln, Hilfsverben oder Flexionsendungen. |
| `helpViewsTitle` | Die drei Ansichten |
| `helpViewArcs` | Bögen — Abhängigkeiten als Bögen über dem laufenden Satz; gut, um Distanz und Verschachtelung zu sehen. |
| `helpViewTree` | Baum — der Satz als verzweigte Hierarchie; gut, um zu sehen, was sich wem unterordnet. |
| `helpViewStairs` | CaboCha — das klassische Treppenlayout japanischer NLP-Werkzeuge; jedes Bunsetsu schließt sich an ein weiter unten stehendes an. |
| `helpDiagramTitle` | Das Diagramm lesen |
| `helpDiagramHint` | Probieren Sie es aus — klicken Sie ein Bunsetsu an: |
| `legendSelection` | ausgewähltes Bunsetsu |
| `legendLink` | seine Anbindung (das Bunsetsu, das es modifiziert) |
| `legendChain` | die weitere Kette zum Prädikat |
| `legendUncertain` | unsichere Anbindung (gepunktet) |
| `legendChainNote` | Die Kettenfarbe — und ob sie überhaupt angezeigt wird — lässt sich in den Einstellungen anpassen. |
| `helpConfidenceTitle` | Anbindungskonfidenz |
| `helpConfidenceBody` | Die Analyse stammt von einem statistischen Modell — sie kann falsch sein. Mit aktivierter Option „Zeige Anbindungskonfidenz“ werden unsichere Anbindungen gepunktet dargestellt, und beim Überfahren einer Verbindungslinie erscheint die Wahrscheinlichkeit des Modells — so bleiben Sie den Ergebnissen gegenüber kritisch. |
| `helpTermTitle` | Prädikat und Kopf |
| `helpTermBody` | Jede Kette endet beim Prädikat (述語) des Satzes — der Verb-, Adjektiv- oder Kopulaphrase, an die sich letztlich alles anschließt. In der Linguistik heißt dieses Element auch der Kopf (主辞) des Satzes. |
| `helpTipsTitle` | Tipps |
| `helpTipSelect` | Klicken Sie ein Bunsetsu an, um es zu inspizieren und seine Kette zu verfolgen; erneutes Klicken oder Escape hebt die Auswahl auf. |
| `helpTipHover` | Fahren Sie über eine Verbindungslinie, um ihre Anbindungswahrscheinlichkeit zu sehen. |
| `helpTipSpeak` | 🗣️ liest den Satz (oder ein einzelnes Bunsetsu) vor — Stimme und Tempo finden Sie in den Einstellungen. |

| key | ja |
| --- | --- |
| `helpLabel` | ヘルプ |
| `helpClose` | ヘルプを閉じる |
| `helpAboutTitle` | このアプリについて |
| `helpAboutBody` | 文木は日本語の文の係り受け構造(どの文節がどの文節に係るか)を可視化します。各ボックスは文節、つまり主辞となる内容語と、それに続く助詞・助動詞・活用語尾などの機能要素からなる、日本語の文を区切る基本単位です。 |
| `helpViewsTitle` | 三つの表示 |
| `helpViewArcs` | アーチ — 文の上に係り受けをアーチとして描きます。距離や入れ子構造が見やすい表示です。 |
| `helpViewTree` | ツリー — 文を枝分かれする階層として描きます。何が何にまとまるかが見やすい表示です。 |
| `helpViewStairs` | CaboCha — 日本語NLPツールで伝統的な階段状レイアウト。各文節は下方の文節に係ります。 |
| `helpDiagramTitle` | 図の読み方 |
| `helpDiagramHint` | 試してみましょう — 文節をクリック: |
| `legendSelection` | 選択中の文節 |
| `legendLink` | 係り先(その文節が修飾する文節) |
| `legendChain` | 述語まで続く連鎖 |
| `legendUncertain` | 不確かな係り受け(点線) |
| `legendChainNote` | 連鎖の色や表示の有無は設定で変更できます。 |
| `helpConfidenceTitle` | 係り受けの信頼度 |
| `helpConfidenceBody` | 解析は統計モデルによるもので、誤ることがあります。「係り受けの信頼度を表示」を有効にすると、不確かな係り受けが点線で描かれ、線にカーソルを合わせるとモデルの確率が表示されます。結果を鵜呑みにしないための手がかりです。 |
| `helpTermTitle` | 述語と主辞 |
| `helpTermBody` | どの連鎖も文の述語 — 動詞・形容詞・コピュラなど、最終的にすべての文節が係っていく要素 — に行き着きます。言語学ではこの要素を主辞と呼びます。 |
| `helpTipsTitle` | ヒント |
| `helpTipSelect` | 文節をクリックすると詳細と連鎖が表示されます。もう一度クリックするか Escape で解除します。 |
| `helpTipHover` | 線にカーソルを合わせると係り受けの確率が表示されます。 |
| `helpTipSpeak` | 🗣️ で文(または文節)を読み上げます。声と速さは設定で選べます。 |

| key | zh |
| --- | --- |
| `helpLabel` | 帮助 |
| `helpClose` | 关闭帮助 |
| `helpAboutTitle` | 关于本应用 |
| `helpAboutBody` | 文木(Ayaki)可视化日语句子的依存结构:哪个短语依附于哪个短语。每个方框是一个文节(文節)——日语句子切分的基本短语单位:以一个实词为中心语,后接助词、助动词或活用词尾等功能成分。 |
| `helpViewsTitle` | 三种视图 |
| `helpViewArcs` | 弧线——在句子上方以弧线绘制依存关系,便于观察距离与嵌套。 |
| `helpViewTree` | 树形——将句子绘制为分支层级,便于观察成分的归属。 |
| `helpViewStairs` | CaboCha——日语NLP工具经典的阶梯布局,每个文节依附于其下方的文节。 |
| `helpDiagramTitle` | 如何解读图示 |
| `helpDiagramHint` | 试一试——点击任意文节: |
| `legendSelection` | 选中的文节 |
| `legendLink` | 它的依附对象(该文节所修饰的文节) |
| `legendChain` | 一直延伸到谓语的依存链 |
| `legendUncertain` | 不确定的依存(虚线) |
| `legendChainNote` | 依存链的颜色以及是否显示可在设置中调整。 |
| `helpConfidenceTitle` | 依存置信度 |
| `helpConfidenceBody` | 句法分析来自统计模型,可能出错。启用「显示依存置信度」后,不确定的依存关系以虚线绘制,将鼠标悬停在连线上可查看模型给出的概率,帮助你对分析结果保持审慎。 |
| `helpTermTitle` | 谓语与中心语 |
| `helpTermBody` | 每条依存链最终都汇聚到句子的谓语(述語)——动词、形容词或系词短语,其他成分最终都依附于它。在语言学中,这一成分称为句子的中心语(主辞)。 |
| `helpTipsTitle` | 小提示 |
| `helpTipSelect` | 点击文节可查看详情并追踪其依存链;再次点击或按 Escape 取消选择。 |
| `helpTipHover` | 将鼠标悬停在连线上可查看依存概率。 |
| `helpTipSpeak` | 🗣️ 可朗读整句(或单个文节)——语音和语速可在设置中调整。 |

## Ripple effects

- **README screenshots:** the header gains a button — all three
  screenshots regenerate via `npm run shots` (standing rule: a chrome
  change invalidates the whole set).
- **`scripts/live-check.mjs`:** a ninth check `help` — click the help
  button (locale is pinned en-US, so its accessible name is `help`),
  assert the dialog is open and the demo renders 4 `g.bunsetsu` inside it,
  close via the close-help button, assert it closed.

## Not changing

`settings.ts` (no new setting), `chainpalette.ts`, the view components
(StairView is consumed as-is), Toolbar, SettingsMenu, Inspector, parser.

## Error handling

| Situation | Behavior |
| --- | --- |
| `chainColor` is `'none'` | demo falls back to amber; legend note explains configurability |
| Help opened before any parse / while dictionary loads | works — the demo uses the hardcoded fixture |
| jsdom without full `<dialog>` support | tests assert the `open` attribute after `showModal()`; the final review's live-browser pass is the real gate for focus trap/backdrop |
| No speech voices | tips still mention 🗣️ — the settings popup already explains the unavailability |

## Testing

- `tests/components/HelpDialog.test.ts` (new):
  - the "?" trigger renders with accessible name `help`;
  - opening shows a dialog containing all six `<h3>` section headings;
  - the demo renders 4 bunsetsu, 新しい selected, chain classes present,
    and the uncertain connector carries the `low` class;
  - clicking 見に moves the demo selection (and re-clicking clears it);
  - with `chainColor: 'none'` the demo svg still carries the amber chain
    custom property (`#b07a2a`);
  - the close button closes the dialog;
  - Escape inside the dialog does NOT propagate to a document-level
    listener (stopPropagation sibling test, per the delegation lesson).
- `tests/components/App.test.ts`: the header exposes the help button;
  opening it shows the dialog (wiring test).
- Catalog parity: compile-time `Record` typing + the existing runtime
  parity test cover the 23 new keys automatically.
- Final whole-branch review includes the live-browser pass: real focus
  trap, backdrop click, Escape isolation, demo interactivity.
