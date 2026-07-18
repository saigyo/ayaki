# UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full UI localization in EN/DE/JA/ZH — selectable, persisted, defaulting to the browser locale with EN fallback — including localized POS/conjugation glosses resolved at render time.

**Architecture:** `src/lib/i18n.svelte.ts` holds the resolved locale as a module-level rune and exposes `t(key, params?)`; four typed catalogs live in `src/lib/locales/`. The gloss tables in `pos.ts` gain DE/ZH columns and are resolved at render time (`posGloss`/`conjugationGloss`), so `MorphemeVM` drops its baked-in English glosses. A 🌐 selector joins the toolbar; `Settings.locale` (`null` = follow browser) persists the choice.

**Tech Stack:** Svelte 5 runes (module-level `$state` in a `.svelte.ts` file), TypeScript strict, vitest + @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-07-18-localization-design.md`

## Global Constraints

- `Locale = 'en' | 'de' | 'ja' | 'zh'`; `Settings.locale: Locale | null`, default `null` (= auto: first `navigator.languages` entry whose lowercase form starts with a supported prefix wins; no match → `en`).
- `en.ts` is the reference catalog; `MessageKey = keyof typeof en`; the other catalogs are typed `Record<MessageKey, string>` — missing/extra keys must be compile errors.
- Glosses resolve at render time; in the JA locale `posGloss`/`conjugationGloss` return `null` (Japanese term stands alone). Unknown terms → `null` (matches today).
- The app title 文木 Ayaki and proper names (sasara, kuromoji.js, Jisho, Google Translate, license names) are never translated.
- Google Translate `tl` = resolved locale, except JA → `en`.
- The i18n module sets `document.documentElement.lang` to the resolved locale (guarded for non-browser environments).
- Message parameters use `{name}` substitution — no plural machinery.
- Svelte 5 runes only; TypeScript strict; unkeyed `{#each}` for wholesale-replaced lists; commits get the Co-Authored-By trailer via the repo hook (do not bypass).
- Every task ends green: `npm test -- --run` and `npm run check` before each commit.

---

### Task 1: i18n module and catalogs

**Files:**
- Create: `src/lib/i18n.svelte.ts`, `src/lib/locales/en.ts`, `src/lib/locales/de.ts`, `src/lib/locales/ja.ts`, `src/lib/locales/zh.ts`
- Test: create `tests/lib/i18n.test.ts`

**Interfaces:**
- Produces (all later tasks rely on these):
  - `type Locale = 'en' | 'de' | 'ja' | 'zh'`, `const SUPPORTED_LOCALES: Locale[]`
  - `type MessageKey` (= `keyof typeof en`)
  - `resolveLocale(stored: Locale | null, languages?: readonly string[]): Locale`
  - `setStoredLocale(stored: Locale | null): void` — updates the module rune + `document.documentElement.lang`
  - `currentLocale(): Locale` — reactive
  - `t(key: MessageKey, params?: Record<string, string | number>): string` — reactive

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/i18n.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { currentLocale, resolveLocale, setStoredLocale, t } from '../../src/lib/i18n.svelte'
import { en } from '../../src/lib/locales/en'
import { de } from '../../src/lib/locales/de'
import { ja } from '../../src/lib/locales/ja'
import { zh } from '../../src/lib/locales/zh'

describe('resolveLocale', () => {
  it('prefers the stored locale over the browser list', () => {
    expect(resolveLocale('zh', ['de-DE'])).toBe('zh')
  })
  it('matches base prefixes of browser languages in order', () => {
    expect(resolveLocale(null, ['fr-FR', 'de-AT', 'en-US'])).toBe('de')
    expect(resolveLocale(null, ['zh-TW'])).toBe('zh')
    expect(resolveLocale(null, ['ja'])).toBe('ja')
  })
  it('falls back to en for unsupported or empty lists', () => {
    expect(resolveLocale(null, ['fr-FR', 'ko-KR'])).toBe('en')
    expect(resolveLocale(null, [])).toBe('en')
  })
})

describe('t and locale state', () => {
  it('switches messages and documentElement.lang with the stored locale', () => {
    setStoredLocale('de')
    expect(currentLocale()).toBe('de')
    expect(t('parseButton')).toBe('Analysieren')
    expect(document.documentElement.lang).toBe('de')
    setStoredLocale(null) // jsdom navigator.languages is en-US → en
    expect(currentLocale()).toBe('en')
    expect(t('parseButton')).toBe('Parse')
    expect(document.documentElement.lang).toBe('en')
  })
  it('substitutes {name} parameters', () => {
    setStoredLocale('en')
    expect(t('sentenceHeadingN', { index: 2, total: 5 })).toBe('Sentence 2 / 5')
    expect(t('uncertaintyNote', { uncertain: 3, total: 8 })).toBe('3 of 8 attachments uncertain')
  })
})

describe('catalog parity', () => {
  it('all four catalogs share an identical key set', () => {
    const keys = Object.keys(en).sort()
    expect(Object.keys(de).sort()).toEqual(keys)
    expect(Object.keys(ja).sort()).toEqual(keys)
    expect(Object.keys(zh).sort()).toEqual(keys)
  })
  it('no catalog has empty values', () => {
    for (const cat of [en, de, ja, zh]) {
      for (const [k, v] of Object.entries(cat)) expect(v, k).not.toBe('')
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/lib/i18n.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create the reference catalog**

Create `src/lib/locales/en.ts`:

```ts
export const en = {
  // toolbar
  furiganaToggle: 'furigana',
  viewGroupLabel: 'tree view style',
  viewArcs: 'arcs',
  viewTree: 'tree',
  rateLabel: 'speech rate',
  voiceLabel: 'voice',
  voiceAuto: 'auto',
  localeLabel: 'language',
  localeAuto: 'Auto (browser)',
  // input
  inputPlaceholder: 'Enter a Japanese sentence…',
  inputLabel: 'Japanese text to parse',
  parseButton: 'Parse',
  idleHint: 'Enter a Japanese sentence and press Parse —',
  exampleLink: 'try the example',
  loadingDict: 'loading dictionary (~4 MB, first time only)…',
  loadingParse: 'parsing…',
  initError: 'Could not initialize the parser: {message}',
  retry: 'Retry',
  sentenceError: 'could not parse: {message}',
  // inspector
  sentenceHeading: 'Sentence',
  sentenceHeadingN: 'Sentence {index} / {total}',
  sentenceHint: 'Parse a sentence, then click a part of it to inspect readings and parts of speech.',
  speakButton: 'Speak',
  stopButton: 'Stop',
  uncertaintyNote: '{uncertain} of {total} attachments uncertain',
  attachment: 'attachment: {label}',
  confProb: 'P = {p}%',
  confProbForced: 'P = {p}% (forced)',
  confForcedOnly: 'forced attachment (end-of-sentence fallback)',
  speakTitle: 'Speak with Web Speech',
  noVoice: 'No Japanese voice available in this browser',
  speakBunsetsu: 'speak bunsetsu',
  speakItem: 'speak {surface}',
  baseForm: 'base form:',
  // footer (skeleton: "{footerParsing} sasara (MIT) — {footerModel} CC BY-SA 4.0,
  // {footerDerived} UD Japanese-GSD — {footerMorphology} kuromoji.js (Apache-2.0)
  // {footerDict}. {footerSelf}")
  footerParsing: 'Parsing by',
  footerModel: 'model',
  footerDerived: 'derived from',
  footerMorphology: 'morphology by',
  footerDict: 'with the IPAdic dictionary (IPADIC license)',
  footerSelf: 'Ayaki itself is MIT.',
} as const
```

- [ ] **Step 4: Create the translated catalogs**

Create `src/lib/locales/de.ts`:

```ts
import type { en } from './en'

export const de: Record<keyof typeof en, string> = {
  furiganaToggle: 'Furigana',
  viewGroupLabel: 'Baumdarstellung',
  viewArcs: 'Bögen',
  viewTree: 'Baum',
  rateLabel: 'Sprechtempo',
  voiceLabel: 'Stimme',
  voiceAuto: 'automatisch',
  localeLabel: 'Sprache',
  localeAuto: 'Auto (Browser)',
  inputPlaceholder: 'Japanischen Satz eingeben…',
  inputLabel: 'Japanischer Text zum Analysieren',
  parseButton: 'Analysieren',
  idleHint: 'Gib einen japanischen Satz ein und drücke Analysieren —',
  exampleLink: 'Beispiel ausprobieren',
  loadingDict: 'Wörterbuch wird geladen (~4 MB, nur beim ersten Mal)…',
  loadingParse: 'Analyse läuft…',
  initError: 'Der Parser konnte nicht initialisiert werden: {message}',
  retry: 'Erneut versuchen',
  sentenceError: 'konnte nicht analysiert werden: {message}',
  sentenceHeading: 'Satz',
  sentenceHeadingN: 'Satz {index} / {total}',
  sentenceHint: 'Analysiere einen Satz und klicke dann auf einen Teil, um Lesungen und Wortarten zu sehen.',
  speakButton: 'Vorlesen',
  stopButton: 'Stopp',
  uncertaintyNote: '{uncertain} von {total} Anbindungen unsicher',
  attachment: 'Anbindung: {label}',
  confProb: 'P = {p} %',
  confProbForced: 'P = {p} % (erzwungen)',
  confForcedOnly: 'erzwungene Anbindung (Satzende-Fallback)',
  speakTitle: 'Mit Web Speech vorlesen',
  noVoice: 'In diesem Browser ist keine japanische Stimme verfügbar',
  speakBunsetsu: 'Bunsetsu vorlesen',
  speakItem: '{surface} vorlesen',
  baseForm: 'Grundform:',
  footerParsing: 'Parsing durch',
  footerModel: 'Modell',
  footerDerived: 'abgeleitet von',
  footerMorphology: 'Morphologie durch',
  footerDict: 'mit dem IPAdic-Wörterbuch (IPADIC-Lizenz)',
  footerSelf: 'Ayaki selbst steht unter MIT-Lizenz.',
}
```

Create `src/lib/locales/ja.ts`:

```ts
import type { en } from './en'

export const ja: Record<keyof typeof en, string> = {
  furiganaToggle: 'ルビ',
  viewGroupLabel: '表示形式',
  viewArcs: 'アーク',
  viewTree: 'ツリー',
  rateLabel: '読み上げ速度',
  voiceLabel: '音声',
  voiceAuto: '自動',
  localeLabel: '言語',
  localeAuto: '自動（ブラウザ）',
  inputPlaceholder: '日本語の文を入力してください…',
  inputLabel: '解析する日本語の文',
  parseButton: '解析',
  idleHint: '日本語の文を入力して「解析」を押してください —',
  exampleLink: '例文で試してみる',
  loadingDict: '辞書を読み込んでいます…（約4 MB、初回のみ）',
  loadingParse: '解析中…',
  initError: 'パーサーを初期化できませんでした：{message}',
  retry: '再試行',
  sentenceError: '解析できませんでした：{message}',
  sentenceHeading: '文',
  sentenceHeadingN: '文 {index} / {total}',
  sentenceHint: '文を解析してから、文節をクリックすると読みと品詞が確認できます。',
  speakButton: '読み上げ',
  stopButton: '停止',
  uncertaintyNote: '係り先 {total} 件中 {uncertain} 件が不確実',
  attachment: '係り受け：{label}',
  confProb: 'P = {p}%',
  confProbForced: 'P = {p}%（強制）',
  confForcedOnly: '強制的な係り受け（文末フォールバック）',
  speakTitle: 'Web Speech で読み上げ',
  noVoice: 'このブラウザでは日本語の音声が利用できません',
  speakBunsetsu: '文節を読み上げ',
  speakItem: '{surface}を読み上げ',
  baseForm: '基本形：',
  footerParsing: '構文解析:',
  footerModel: 'モデル:',
  footerDerived: '由来:',
  footerMorphology: '形態素解析:',
  footerDict: '＋IPAdic 辞書（IPADIC ライセンス）',
  footerSelf: 'Ayaki 本体は MIT ライセンスです。',
}
```

Create `src/lib/locales/zh.ts`:

```ts
import type { en } from './en'

export const zh: Record<keyof typeof en, string> = {
  furiganaToggle: '振假名',
  viewGroupLabel: '树形显示方式',
  viewArcs: '弧线',
  viewTree: '树形',
  rateLabel: '语速',
  voiceLabel: '语音',
  voiceAuto: '自动',
  localeLabel: '语言',
  localeAuto: '自动（浏览器）',
  inputPlaceholder: '请输入日语句子…',
  inputLabel: '要解析的日语文本',
  parseButton: '解析',
  idleHint: '输入日语句子并点击「解析」 —',
  exampleLink: '试试例句',
  loadingDict: '正在加载词典（约 4 MB，仅首次）…',
  loadingParse: '解析中…',
  initError: '无法初始化解析器：{message}',
  retry: '重试',
  sentenceError: '无法解析：{message}',
  sentenceHeading: '句子',
  sentenceHeadingN: '句子 {index} / {total}',
  sentenceHint: '解析句子后，点击句子成分即可查看读音和词性。',
  speakButton: '朗读',
  stopButton: '停止',
  uncertaintyNote: '{total} 个依存关系中有 {uncertain} 个不确定',
  attachment: '依存关系：{label}',
  confProb: 'P = {p}%',
  confProbForced: 'P = {p}%（强制）',
  confForcedOnly: '强制依存（句末回退）',
  speakTitle: '使用 Web Speech 朗读',
  noVoice: '此浏览器没有可用的日语语音',
  speakBunsetsu: '朗读文节',
  speakItem: '朗读{surface}',
  baseForm: '基本形：',
  footerParsing: '句法分析:',
  footerModel: '模型:',
  footerDerived: '源自:',
  footerMorphology: '形态分析:',
  footerDict: '并使用 IPAdic 词典（IPADIC 许可）',
  footerSelf: 'Ayaki 本身采用 MIT 许可。',
}
```

- [ ] **Step 5: Create the i18n module**

Create `src/lib/i18n.svelte.ts`:

```ts
import { en } from './locales/en'
import { de } from './locales/de'
import { ja } from './locales/ja'
import { zh } from './locales/zh'

export type Locale = 'en' | 'de' | 'ja' | 'zh'
export type MessageKey = keyof typeof en

export const SUPPORTED_LOCALES: Locale[] = ['en', 'de', 'ja', 'zh']

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, de, ja, zh }

export function resolveLocale(
  stored: Locale | null,
  languages: readonly string[] = globalThis.navigator?.languages ?? [],
): Locale {
  if (stored) return stored
  for (const lang of languages) {
    const match = SUPPORTED_LOCALES.find((l) => lang.toLowerCase().startsWith(l))
    if (match) return match
  }
  return 'en'
}

const state = $state({ locale: resolveLocale(null) })

export function setStoredLocale(stored: Locale | null): void {
  state.locale = resolveLocale(stored)
  if (typeof document !== 'undefined') document.documentElement.lang = state.locale
}

export function currentLocale(): Locale {
  return state.locale
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let msg = catalogs[state.locale][key]
  if (params) {
    for (const [k, v] of Object.entries(params)) msg = msg.replaceAll(`{${k}}`, String(v))
  }
  return msg
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- --run tests/lib/i18n.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Full suite, check, commit**

Run: `npm test -- --run && npm run check` — all green. Then:

```bash
git add src/lib/i18n.svelte.ts src/lib/locales tests/lib/i18n.test.ts
git commit -m "feat: i18n module with EN/DE/JA/ZH catalogs and browser-locale resolution"
```

---

### Task 2: locale setting + App persistence

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/components/App.svelte` (settings block only)
- Test: `tests/lib/settings.test.ts`, `tests/components/App.test.ts`

**Interfaces:**
- Consumes (Task 1): `Locale`, `SUPPORTED_LOCALES`, `setStoredLocale` from `src/lib/i18n.svelte`.
- Produces: `Settings.locale: Locale | null` (default `null`); App holds `locale` state, persists it, and mirrors it into the i18n module via an `$effect`.

- [ ] **Step 1: Write the failing tests**

In `tests/lib/settings.test.ts`, update the round-trip test's object to include the new field:

```ts
    const s = { showFurigana: true, view: 'tree' as const, rate: 1.3, voiceURI: 'kyoko', locale: 'de' as const }
```

and append inside `describe('loadSettings', …)`:

```ts
  it('accepts the four locale codes and null, rejects others', () => {
    for (const code of ['en', 'de', 'ja', 'zh']) {
      localStorage.setItem(KEY, JSON.stringify({ locale: code }))
      expect(loadSettings().locale).toBe(code)
    }
    localStorage.setItem(KEY, JSON.stringify({ locale: null }))
    expect(loadSettings().locale).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ locale: 'fr' }))
    expect(loadSettings().locale).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ locale: 7 }))
    expect(loadSettings().locale).toBeNull()
  })
```

In `tests/components/App.test.ts`, extend the persisted-object assertion in `'restores settings from localStorage and persists changes'`:

```ts
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!)).toEqual({
      showFurigana: false,
      view: 'tree',
      rate: 1.2,
      voiceURI: null,
      locale: null,
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/lib/settings.test.ts tests/components/App.test.ts`
Expected: FAIL — `locale` unknown to `Settings`, not persisted.

- [ ] **Step 3: Implement**

In `src/lib/settings.ts`:

```ts
import { SUPPORTED_LOCALES, type Locale } from './i18n.svelte'

export interface Settings {
  showFurigana: boolean
  view: 'arcs' | 'tree'
  rate: number
  voiceURI: string | null
  locale: Locale | null
}

export const DEFAULTS: Settings = { showFurigana: false, view: 'arcs', rate: 1, voiceURI: null, locale: null }
```

and one line in the validator table:

```ts
  locale: (v) => (v === null || SUPPORTED_LOCALES.includes(v as Locale) ? (v as Locale | null) : undefined),
```

In `src/components/App.svelte`, extend the settings block:

```ts
  import { setStoredLocale } from '../lib/i18n.svelte'
```

```ts
  const initialSettings = loadSettings()
  let showFurigana = $state(initialSettings.showFurigana)
  let view = $state<'arcs' | 'tree'>(initialSettings.view)
  let rate = $state(initialSettings.rate)
  let voiceURI = $state(initialSettings.voiceURI)
  let locale = $state(initialSettings.locale)

  $effect(() => {
    saveSettings({ showFurigana, view, rate, voiceURI, locale })
  })

  $effect(() => {
    setStoredLocale(locale)
  })
```

- [ ] **Step 4: Run the full suite and check**

Run: `npm test -- --run && npm run check`
Expected: all PASS, 0 check errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/components/App.svelte tests/lib/settings.test.ts tests/components/App.test.ts
git commit -m "feat: persist UI locale in settings"
```

---

### Task 3: localized glosses, resolved at render time

**Files:**
- Modify: `src/lib/pos.ts` (gloss tables gain de/zh; new `combinePos`, `posGloss`, `conjugationGloss`; `posLabel`/`conjugationLabel`/`Label` removed)
- Modify: `src/lib/viewmodel.ts` (drop `posEn`/`conjugationEn`; `confidenceLabel` moves to `t()` keys)
- Modify: `src/lib/types.ts` (`MorphemeVM` drops `posEn`, `conjugationEn`)
- Modify: `src/components/Inspector.svelte` (render-time gloss lookup)
- Test: `tests/lib/pos.test.ts`, `tests/lib/viewmodel.test.ts`, `tests/fixtures.ts`, `tests/components/Inspector.test.ts`

**Interfaces:**
- Consumes (Task 1): `currentLocale`, `t`, `type Locale`.
- Produces:
  - `combinePos(pos: string, detail1?: string): string` — `名詞・一般` style
  - `posGloss(posJa: string, locale: Locale): string | null`
  - `conjugationGloss(conjugationJa: string, locale: Locale): string | null`
  - `MorphemeVM` without `posEn`/`conjugationEn`
  - `confidenceLabel(b)` now returns localized strings via `t()`

- [ ] **Step 1: Rewrite the pos tests (failing)**

In `tests/lib/pos.test.ts`, replace every `posLabel`/`conjugationLabel` test with tests of the new API (keep the `toHiragana`/`hasKanji` tests untouched). Replace the import line to pull `combinePos, conjugationGloss, posGloss` from `'../../src/lib/pos'` and add:

```ts
describe('combinePos', () => {
  it('joins pos and meaningful detail with ・', () => {
    expect(combinePos('名詞', '一般')).toBe('名詞・一般')
    expect(combinePos('動詞', '*')).toBe('動詞')
    expect(combinePos('感動詞')).toBe('感動詞')
  })
})

describe('posGloss', () => {
  it('resolves per locale', () => {
    expect(posGloss('名詞・一般', 'en')).toBe('noun (general)')
    expect(posGloss('名詞・一般', 'de')).toBe('Nomen (allgemein)')
    expect(posGloss('名詞・一般', 'zh')).toBe('名词（一般）')
    expect(posGloss('助詞・格助詞', 'de')).toBe('Partikel (kasusmarkierend)')
  })
  it('returns null for the ja locale and for unknown terms', () => {
    expect(posGloss('名詞・一般', 'ja')).toBeNull()
    expect(posGloss('謎の品詞', 'en')).toBeNull()
  })
  it('handles detail-less terms and unknown details', () => {
    expect(posGloss('感動詞', 'en')).toBe('interjection')
    expect(posGloss('名詞・未知の細分類', 'en')).toBe('noun')
  })
})

describe('conjugationGloss', () => {
  it('resolves per locale and hides for ja', () => {
    expect(conjugationGloss('連用形', 'en')).toBe('continuative')
    expect(conjugationGloss('連用形', 'de')).toBe('Verbindungsform')
    expect(conjugationGloss('連用形', 'zh')).toBe('连用形')
    expect(conjugationGloss('連用形', 'ja')).toBeNull()
    expect(conjugationGloss('未知の活用形', 'en')).toBeNull()
  })
})

describe('gloss table completeness', () => {
  // exported for this test: add `export const GLOSS_TABLES = { POS_GLOSS, DETAIL_GLOSS, CONJ_GLOSS }` in pos.ts
  it('every term has non-empty en, de and zh glosses', () => {
    for (const table of Object.values(GLOSS_TABLES)) {
      for (const [term, gloss] of Object.entries(table)) {
        for (const loc of ['en', 'de', 'zh'] as const) {
          expect(gloss[loc], `${term}.${loc}`).toBeTruthy()
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run tests/lib/pos.test.ts`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Implement the localized gloss tables**

In `src/lib/pos.ts`, keep `toHiragana` and `hasKanji` unchanged; replace everything from `export interface Label` to the end of the file with:

```ts
import type { Locale } from './i18n.svelte'

type Gloss = { en: string; de: string; zh: string }
type GlossLocale = keyof Gloss

const POS_GLOSS: Record<string, Gloss> = {
  名詞: { en: 'noun', de: 'Nomen', zh: '名词' },
  動詞: { en: 'verb', de: 'Verb', zh: '动词' },
  形容詞: { en: 'i-adjective', de: 'I-Adjektiv', zh: '形容词（イ形）' },
  副詞: { en: 'adverb', de: 'Adverb', zh: '副词' },
  連体詞: { en: 'adnominal', de: 'Adnominal', zh: '连体词' },
  接続詞: { en: 'conjunction', de: 'Konjunktion', zh: '接续词' },
  助詞: { en: 'particle', de: 'Partikel', zh: '助词' },
  助動詞: { en: 'auxiliary verb', de: 'Hilfsverb', zh: '助动词' },
  感動詞: { en: 'interjection', de: 'Interjektion', zh: '感叹词' },
  記号: { en: 'symbol', de: 'Symbol', zh: '符号' },
  接頭詞: { en: 'prefix', de: 'Präfix', zh: '接头词' },
  フィラー: { en: 'filler', de: 'Füllwort', zh: '填充词' },
  その他: { en: 'other', de: 'Sonstiges', zh: '其他' },
  未知語: { en: 'unknown word', de: 'unbekanntes Wort', zh: '未知词' },
}

const DETAIL_GLOSS: Record<string, Gloss> = {
  一般: { en: 'general', de: 'allgemein', zh: '一般' },
  固有名詞: { en: 'proper noun', de: 'Eigenname', zh: '专有名词' },
  代名詞: { en: 'pronoun', de: 'Pronomen', zh: '代词' },
  数: { en: 'number', de: 'Zahl', zh: '数词' },
  サ変接続: { en: 'suru-verb noun', de: 'Suru-Verb-Nomen', zh: 'サ变动词名词' },
  形容動詞語幹: { en: 'na-adjective stem', de: 'Na-Adjektiv-Stamm', zh: '形容动词词干' },
  副詞可能: { en: 'adverbial', de: 'adverbial nutzbar', zh: '可作副词' },
  接尾: { en: 'suffix', de: 'Suffix', zh: '接尾词' },
  非自立: { en: 'dependent', de: 'gebunden', zh: '非独立' },
  自立: { en: 'independent', de: 'selbstständig', zh: '独立' },
  格助詞: { en: 'case-marking', de: 'kasusmarkierend', zh: '格助词' },
  係助詞: { en: 'binding', de: 'bindend', zh: '系助词' },
  副助詞: { en: 'adverbial', de: 'adverbial', zh: '副助词' },
  終助詞: { en: 'sentence-final', de: 'satzfinal', zh: '终助词' },
  接続助詞: { en: 'conjunctive', de: 'konjunktional', zh: '接续助词' },
  並立助詞: { en: 'parallel', de: 'parallel', zh: '并列助词' },
  準体助詞: { en: 'nominalizing', de: 'nominalisierend', zh: '准体助词' },
  連体化: { en: 'adnominalizing', de: 'adnominalisierend', zh: '连体化' },
  副詞化: { en: 'adverbializing', de: 'adverbialisierend', zh: '副词化' },
  人名: { en: 'person name', de: 'Personenname', zh: '人名' },
  地域: { en: 'place name', de: 'Ortsname', zh: '地名' },
  組織: { en: 'organization', de: 'Organisation', zh: '组织' },
  句点: { en: 'period', de: 'Punkt', zh: '句号' },
  読点: { en: 'comma', de: 'Komma', zh: '逗号' },
  括弧開: { en: 'open bracket', de: 'öffnende Klammer', zh: '左括号' },
  括弧閉: { en: 'close bracket', de: 'schließende Klammer', zh: '右括号' },
  空白: { en: 'space', de: 'Leerzeichen', zh: '空格' },
  アルファベット: { en: 'alphabet', de: 'Alphabet', zh: '字母' },
  引用: { en: 'quotation', de: 'Zitat', zh: '引用' },
  特殊: { en: 'special', de: 'Sonderzeichen', zh: '特殊' },
}

const CONJ_GLOSS: Record<string, Gloss> = {
  基本形: { en: 'plain form', de: 'Grundform', zh: '基本形' },
  連用形: { en: 'continuative', de: 'Verbindungsform', zh: '连用形' },
  連用タ接続: { en: 'ta-continuative', de: 'Ta-Verbindungsform', zh: '连用タ接续' },
  未然形: { en: 'irrealis', de: 'Irrealisform', zh: '未然形' },
  仮定形: { en: 'conditional', de: 'Konditionalform', zh: '假定形' },
  体言接続: { en: 'attributive', de: 'Attributivform', zh: '体言接续' },
  命令ｅ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  命令ｉ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  命令ｒｏ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  命令ｙｏ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  未然ウ接続: { en: 'volitional stem', de: 'Volitionalstamm', zh: '意志形词干' },
  ガル接続: { en: 'garu-stem', de: 'Garu-Stamm', zh: 'ガル接续' },
}

/** ZH glosses wrap details in fullwidth parentheses; EN/DE use halfwidth. */
function withDetail(locale: GlossLocale, pos: string, detail?: string): string {
  if (!detail) return pos
  return locale === 'zh' ? `${pos}（${detail}）` : `${pos} (${detail})`
}

export function combinePos(pos: string, detail1?: string): string {
  const hasDetail = !!detail1 && detail1 !== '*'
  return hasDetail ? `${pos}・${detail1}` : pos
}

export function posGloss(posJa: string, locale: Locale): string | null {
  if (locale === 'ja') return null
  const [pos, detail] = posJa.split('・')
  const posPart = POS_GLOSS[pos]?.[locale]
  if (!posPart) return null
  const detailPart = detail ? DETAIL_GLOSS[detail]?.[locale] : undefined
  return withDetail(locale, posPart, detailPart)
}

export function conjugationGloss(conjugationJa: string, locale: Locale): string | null {
  if (locale === 'ja') return null
  return CONJ_GLOSS[conjugationJa]?.[locale] ?? null
}
```

- [ ] **Step 4: Update viewmodel, types, fixtures, Inspector**

In `src/lib/types.ts`, remove the `posEn: string | null` and `conjugationEn: string | null` lines from `MorphemeVM`.

In `src/lib/viewmodel.ts`:
- change the pos import line to `import { combinePos, hasKanji, toHiragana } from './pos'`
- add `import { t } from './i18n.svelte'`
- in the morpheme builder, replace the `posLabel`/`conjugationLabel` usage:

```ts
  const posJa = combinePos(t2.pos, t2.pos_detail_1)
```

(where `t2` is the token parameter — rename the existing parameter from `t` to `t2` throughout the function to avoid shadowing the imported `t`), and set `posJa`, `conjugationJa: t2.conjugated_form && t2.conjugated_form !== '*' ? t2.conjugated_form : null`, dropping the `posEn`/`conjugationEn` properties.
- replace `confidenceLabel` with the localized version:

```ts
export function confidenceLabel(b: BunsetsuVM): string | null {
  if (b.probability !== null) {
    const p = Math.round(b.probability * 100)
    return b.forced ? t('confProbForced', { p }) : t('confProb', { p })
  }
  return b.forced ? t('confForcedOnly') : null
}
```

In `tests/fixtures.ts`, delete every `posEn:` and `conjugationEn:` property (the fixture builder and all overrides). Then run `grep -rn "posEn\|conjugationEn" tests/ src/` — every remaining hit (e.g. assertions in `tests/integration/pipeline.test.ts`, if any) must be updated to the new model: assert `posJa`/`conjugationJa` instead, or assert the render-time gloss via `posGloss(..., 'en')`. Zero hits must remain outside this plan's own text.

Also add the table export at the bottom of `src/lib/pos.ts` (consumed by the completeness test):

```ts
export const GLOSS_TABLES = { POS_GLOSS, DETAIL_GLOSS, CONJ_GLOSS }
```

and add `GLOSS_TABLES` to the import in `tests/lib/pos.test.ts`.

In `src/components/Inspector.svelte`:
- add `import { currentLocale } from '../lib/i18n.svelte'` and `import { conjugationGloss, posGloss } from '../lib/pos'`
- replace the two gloss lines:

```svelte
        {@const pg = posGloss(m.posJa, currentLocale())}
        <div class="m-pos"><span lang="ja">{m.posJa}</span>{#if pg}<span class="en">{pg}</span>{/if}</div>
```

```svelte
        {#if m.conjugationJa}
          {@const cg = conjugationGloss(m.conjugationJa, currentLocale())}
          <div class="m-conj"><span lang="ja">{m.conjugationJa}</span>{#if cg}<span class="en">{cg}</span>{/if}</div>
        {/if}
```

In `tests/lib/viewmodel.test.ts`, update any assertion on `posEn`/`conjugationEn` to assert the fields are absent (`expect('posEn' in m).toBe(false)` where the old assertions were) and that `confidenceLabel` still produces `'P = 55%'` etc. under the default EN locale (add `import { setStoredLocale } from '../../src/lib/i18n.svelte'` and `setStoredLocale('en')` at the top of the affected describe if the file runs under jsdom; if it runs in node, `resolveLocale(null)` already yields `'en'` because `navigator` is undefined).

In `tests/components/Inspector.test.ts`, the assertions on `'verb (independent)'` and `'連用形'` remain valid under the default EN locale — no changes expected beyond removing any fixture-driven expectations of removed fields.

- [ ] **Step 5: Run the full suite and check**

Run: `npm test -- --run && npm run check`
Expected: all PASS, 0 check errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pos.ts src/lib/viewmodel.ts src/lib/types.ts src/components/Inspector.svelte tests/lib/pos.test.ts tests/lib/viewmodel.test.ts tests/fixtures.ts tests/components/Inspector.test.ts
git commit -m "feat: localized POS and conjugation glosses resolved at render time"
```

---

### Task 4: Toolbar chrome + locale selector, SentenceInput

**Files:**
- Modify: `src/components/Toolbar.svelte`
- Modify: `src/components/SentenceInput.svelte`
- Test: `tests/components/Toolbar.test.ts`, `tests/components/App.test.ts` (only where noted)

**Interfaces:**
- Consumes (Task 1): `t`, `SUPPORTED_LOCALES`, `type Locale`.
- Produces: Toolbar prop `locale?: Locale | null` bindable (default `null`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/Toolbar.test.ts` (inside the existing describe or a new one; the file already imports `render`, `screen`, `vi`, `userEvent` and defines `base`):

```ts
import { setStoredLocale } from '../../src/lib/i18n.svelte'

describe('Toolbar locale selector', () => {
  it('lists auto plus the four languages named in themselves', () => {
    setStoredLocale('en')
    render(Toolbar, { props: { ...base, locale: null } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Auto (browser)', 'English', 'Deutsch', '日本語', '中文',
    ])
    expect(select.value).toBe('')
  })
  it('maps auto to null and codes to codes on change', async () => {
    setStoredLocale('en')
    const user = userEvent.setup()
    render(Toolbar, { props: { ...base, locale: 'de' } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    expect(select.value).toBe('de')
    await user.selectOptions(select, '')
    expect(select.value).toBe('')
  })
  it('localizes the toolbar chrome', () => {
    setStoredLocale('de')
    render(Toolbar, { props: { ...base } })
    expect(screen.getByText(/Furigana/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Baum$/ })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Sprechtempo' })).toBeInTheDocument()
    setStoredLocale('en')
  })
})
```

(Note: existing Toolbar voice tests use `{ name: 'voice' }` — they keep passing under the default EN locale.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run tests/components/Toolbar.test.ts`
Expected: the three new tests FAIL (no locale selector, chrome hardcoded).

- [ ] **Step 3: Implement Toolbar**

Replace the full contents of `src/components/Toolbar.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { listJaVoices } from '../lib/speech'
  import { t, type Locale } from '../lib/i18n.svelte'

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
  const LOCALES: Locale[] = ['en', 'de', 'ja', 'zh']
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
    {#each LOCALES as l}
      <option value={l} selected={l === locale}>{LOCALE_NAMES[l]}</option>
    {/each}
  </select>
</div>
```

In `src/app.css`, extend the voice-select rule (line ~21) to cover both selects:

```css
.toolbar select.voice, .toolbar select.locale { border: 1px solid var(--box-stroke); background: #fff; padding: 0.25rem; border-radius: 6px; max-width: 11rem; }
```

(replacing the existing `.toolbar select.voice { … }` rule.)

- [ ] **Step 4: Implement SentenceInput**

Replace the template part of `src/components/SentenceInput.svelte` (script unchanged except the added import):

```svelte
<script lang="ts">
  import { t } from '../lib/i18n.svelte'

  let {
    text = $bindable(),
    busy = false,
    onparse,
  }: {
    text: string
    busy?: boolean
    onparse: () => void
  } = $props()
</script>

<form
  class="sentence-input"
  onsubmit={(e) => {
    e.preventDefault()
    if (text.trim()) onparse()
  }}
>
  <textarea
    bind:value={text}
    lang="ja"
    rows="3"
    placeholder={t('inputPlaceholder')}
    aria-label={t('inputLabel')}
  ></textarea>
  <button type="submit" disabled={busy || !text.trim()}>{t('parseButton')}</button>
</form>
```

- [ ] **Step 5: Update existing test selectors**

The parse button loses its 解析 label under EN. In `tests/components/App.test.ts`, replace every `{ name: /解析/ }` with `{ name: /parse/i }` and `{ name: /試してみる/ }` with `{ name: /try the example/i }`. (`/japanese text/i` still matches the EN `inputLabel`.) In `tests/components/App.test.ts` the 'parses the built-in example from the idle hint' test keeps working via the updated name.

- [ ] **Step 6: Run the full suite and check**

Run: `npm test -- --run && npm run check`
Expected: all PASS (Toolbar 8, App all green with updated selectors), 0 check errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Toolbar.svelte src/components/SentenceInput.svelte src/app.css tests/components/Toolbar.test.ts tests/components/App.test.ts
git commit -m "feat: localized toolbar with locale selector and localized input form"
```

---

### Task 5: App + Inspector chrome, SentenceCard, footer, Translate target

**Files:**
- Modify: `src/components/App.svelte` (hint/loading/error strings, footer, Toolbar/Inspector usage)
- Modify: `src/components/Inspector.svelte` (chrome strings, Translate URL)
- Modify: `src/components/SentenceCard.svelte` (error line)
- Modify: `src/lib/links.ts` (`googleTranslateUrl` gains a locale parameter)
- Test: `tests/lib/links.test.ts`, `tests/components/App.test.ts`, `tests/components/Inspector.test.ts`

**Interfaces:**
- Consumes: `t`, `currentLocale`, `type Locale` (Task 1); Toolbar `locale` bindable (Task 4).
- Produces: `googleTranslateUrl(text: string, locale: Locale): string` — `tl` = locale, except `ja` → `en`.

- [ ] **Step 1: Write the failing tests**

In `tests/lib/links.test.ts`, update the Google Translate tests to the new signature and add the mapping cases:

```ts
  it('targets the UI locale, falling back to en for ja', () => {
    expect(googleTranslateUrl('猫が魚を食べた。', 'de')).toContain('tl=de')
    expect(googleTranslateUrl('猫が魚を食べた。', 'zh')).toContain('tl=zh')
    expect(googleTranslateUrl('猫が魚を食べた。', 'en')).toContain('tl=en')
    expect(googleTranslateUrl('猫が魚を食べた。', 'ja')).toContain('tl=en')
  })
```

(update any existing call sites in that file to pass `'en'`.)

In `tests/components/App.test.ts`, append inside `describe('App', …)`:

```ts
  it('switches chrome and glosses when the locale changes, without re-parsing', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    const box = await screen.findByText('食べた。')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByText('verb (independent)')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'language' }), 'de')
    expect(await screen.findByText('Verb (selbstständig)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analysieren/ })).toBeInTheDocument()
    expect(parseText).toHaveBeenCalledTimes(1)
    // and the locale choice is persisted
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).locale).toBe('de')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sprache' }), '')
    expect(await screen.findByRole('button', { name: /parse/i })).toBeInTheDocument()
  })
```

In `tests/components/Inspector.test.ts`, add (using the existing `sentence` const; `setStoredLocale` imported from `'../../src/lib/i18n.svelte'`):

```ts
  it('renders localized chrome in ZH and hides glosses in JA', () => {
    setStoredLocale('zh')
    const zhView = render(Inspector, { props: { sentence, index: 0, total: 2, selected: null, rate: 1, voiceURI: null } })
    expect(zhView.getByRole('heading', { name: '句子 1 / 2' })).toBeInTheDocument()
    setStoredLocale('ja')
    const jaView = render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: null } })
    expect(jaView.queryByText('verb (independent)')).toBeNull()
    expect(jaView.getByText('動詞・自立')).toBeInTheDocument()
    setStoredLocale('en')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run tests/lib/links.test.ts tests/components/App.test.ts tests/components/Inspector.test.ts`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement links.ts**

In `src/lib/links.ts`, change `googleTranslateUrl` to:

```ts
import type { Locale } from './i18n.svelte'

export function googleTranslateUrl(text: string, locale: Locale): string {
  const tl = locale === 'ja' ? 'en' : locale
  return `https://translate.google.com/?sl=ja&tl=${tl}&op=translate&text=${encodeURIComponent(text)}`
}
```

(keep `jishoUrl` untouched; preserve the existing URL shape apart from the dynamic `tl`.)

- [ ] **Step 4: Implement the component chrome**

In `src/components/App.svelte`:
- add `import { t } from '../lib/i18n.svelte'` (keep the existing `setStoredLocale` import)
- Toolbar usage: `<Toolbar bind:showFurigana bind:view bind:rate bind:voiceURI bind:locale />`
- idle hint block becomes:

```svelte
        <p class="hint">
          {t('idleHint')}
          <button class="linklike" onclick={parseExample}>{t('exampleLink')}</button>
        </p>
```

- loading block:

```svelte
        <p class="loading">
          {parserReady() ? t('loadingParse') : t('loadingDict')}
        </p>
```

- error banner:

```svelte
        <div class="error-banner">
          <p>{t('initError', { message: errorMsg })}</p>
          <button onclick={handleParse}>{t('retry')}</button>
        </div>
```

- footer paragraph:

```svelte
    <p>
      {t('footerParsing')} <a href="https://github.com/iatosh/sasara">sasara</a> (MIT) —
      {t('footerModel')} <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>,
      {t('footerDerived')} <a href="https://github.com/UniversalDependencies/UD_Japanese-GSD">UD Japanese-GSD</a> —
      {t('footerMorphology')} <a href="https://github.com/takuyaa/kuromoji.js">kuromoji.js</a> (Apache-2.0)
      {t('footerDict')}. {t('footerSelf')}
    </p>
```

In `src/components/SentenceCard.svelte`, add `import { t } from '../lib/i18n.svelte'` and change the error line to:

```svelte
    <p class="sentence-error"><span lang="ja">{sentence.text}</span> — {t('sentenceError', { message: sentence.error })}</p>
```

In `src/components/Inspector.svelte` (gloss lookups already localized in Task 3):
- pass the locale to the Translate link: `<a href={googleTranslateUrl(sentence.text, currentLocale())} …>Google Translate ↗</a>`
- heading: `<h2>{total > 1 ? t('sentenceHeadingN', { index: index + 1, total }) : t('sentenceHeading')}</h2>`
- hint: `<p class="hint">{t('sentenceHint')}</p>`
- Speak/Stop buttons: `🔊 {t('speakButton')}` / `⏹ {t('stopButton')}`
- uncertainty note: `{t('uncertaintyNote', { uncertain: uncertainCount, total: sentence.bunsetsu.length - 1 })}`
- attachment line: `{t('attachment', { label })}`
- `speakTitle` derived: `canSpeak ? t('speakTitle') : t('noVoice')`
- bunsetsu speak button aria-label: `{t('speakBunsetsu')}`; morpheme speak buttons: `aria-label={t('speakItem', { surface: m.surface })}`
- base form: `{t('baseForm')} <span lang="ja">{m.baseForm}</span>`

Existing EN-locale test assertions (`Sentence 1 / 2`, `1 of 2 attachments uncertain`, `/speak/i`, `'speak bunsetsu'`) keep matching because the EN catalog reproduces today's strings. The InspectorSpeak tests use `{ name: 'speak bunsetsu' }` and `{ name: 'speak 食べ' }` — both still produced by the EN catalog's `speakItem`/`speakBunsetsu`.

- [ ] **Step 5: Run the full suite and check**

Run: `npm test -- --run && npm run check`
Expected: all PASS, 0 check errors. If any test fails on a leaked locale, ensure each new test resets with `setStoredLocale('en')` (or `null`) at its end as shown.

- [ ] **Step 6: Commit**

```bash
git add src/components/App.svelte src/components/Inspector.svelte src/components/SentenceCard.svelte src/lib/links.ts tests/lib/links.test.ts tests/components/App.test.ts tests/components/Inspector.test.ts
git commit -m "feat: localized app chrome, footer and locale-aware Translate target"
```

---

## Deviations

- **Task 3, Inspector:** Svelte 5 rejects `{@const}` as the direct child of a plain element; the gloss `{@const}` tags sit as immediate children of the `{#each}`/`{#if}` blocks instead of inside the `<div>`s the plan sketched. Rendering unchanged.
- **Task 3, locale determinism in node tests:** the plan assumed `resolveLocale(null)` yields `en` under node (no `navigator`); Node ≥21 exposes `navigator.languages` from the OS locale (`de-DE` on the dev machine), so locale-dependent node tests must pin the locale explicitly (`setStoredLocale('en')` in `beforeEach`). Applied to the `confidenceLabel` describe in `tests/lib/viewmodel.test.ts`.
