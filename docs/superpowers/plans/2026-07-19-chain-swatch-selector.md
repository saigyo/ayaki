# Chain Swatch Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chain-color dropdown with a radio group of chain-look swatches + a slashed "none" tile, and rename the label to "chain to predicate" (述語) in all four locales.

**Architecture:** Pure presentation change inside `SettingsMenu.svelte` (input-then-label sibling pairs, `bind:group`) + CSS + four catalog values. No settings/palette/view changes.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-19-chain-swatch-selector-design.md`

## Global Constraints

- Radio semantics: native radios sharing `name="chain-{uid}"`, `bind:group={chainColor}`; the group's accessible name comes from the fieldset legend (`t('chainLabel')`), each radio's from the localized color name. Visually-hidden inputs must stay focusable — NEVER `display: none`.
- Checked/focus ring via the sibling selector `input:checked + .swatch` / `input:focus-visible + .swatch` — NO `:has()`.
- Swatch look = miniature chain box: `background: var(--sw-soft); border: 2px solid var(--sw)` from per-label custom properties fed by `CHAIN_PALETTE`; the none tile is white with a `var(--danger)` diagonal slash.
- Catalog: ONLY the four `chainLabel` values change (en `chain to predicate`, de `Kette zum Prädikat`, ja `述語への連鎖`, zh `谓语依存链`); the option keys stay as accessible names/tooltips.
- `chainpalette.ts`, `settings.ts`, views, App/SentenceCard plumbing NOT modified. No screenshot regeneration (popup closed in all scenes).
- Test discipline: assertions never weakened; the App chain test only swaps the interaction (combobox select → radio click).
- Conventional Commits; the local git hook adds the Co-Authored-By trailer.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: Swatch radio group + rename

**Files:**
- Modify: `src/components/SettingsMenu.svelte`, `src/app.css` (append + fieldset reset), `src/lib/locales/{en,de,ja,zh}.ts` (one value each)
- Test: `tests/components/SettingsMenu.test.ts`, `tests/components/App.test.ts` (read each first)

**Interfaces:**
- Consumes: `CHAIN_COLORS`, `CHAIN_PALETTE`, `type ChainColor` from `src/lib/chainpalette.ts` (existing); `chainColor` bindable contract unchanged.
- Produces: same `SettingsMenu` props; the chain row is now `fieldset.chain-row` exposing `role="group"` named `chain to predicate` with four radios.

- [ ] **Step 1: Catalog rename**

In each catalog change ONLY the `chainLabel` value:
- en: `chainLabel: 'chain to predicate',`
- de: `chainLabel: 'Kette zum Prädikat',`
- ja: `chainLabel: '述語への連鎖',`
- zh: `chainLabel: '谓语依存链',`

- [ ] **Step 2: Write the failing tests**

In `tests/components/SettingsMenu.test.ts`, REPLACE the test `'offers the chain color select and round-trips it'` with (add `within` to the `@testing-library/svelte` import):

```ts
it('offers the chain swatch radio group and round-trips it', async () => {
  vi.stubGlobal('speechSynthesis', fakeSynth([]))
  const user = userEvent.setup()
  render(SettingsMenu, { props: { ...base, chainColor: 'amber' } })
  await user.click(screen.getByRole('button', { name: 'settings' }))
  const group = screen.getByRole('group', { name: 'chain to predicate' })
  const radios = within(group).getAllByRole('radio')
  expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['amber', 'green', 'violet', 'none'])
  expect(screen.getByRole('radio', { name: 'amber' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'green' }))
  expect(screen.getByRole('radio', { name: 'green' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'amber' })).not.toBeChecked()
})
```

In `tests/components/App.test.ts`, in the test `'traces the chain by default and stops when set to none, without re-parsing'`, replace

```ts
await user.selectOptions(screen.getByRole('combobox', { name: 'chain to main verb' }), 'none')
```

with

```ts
await user.click(screen.getByRole('radio', { name: 'none' }))
```

(Everything else in that test stays.)

Run: `npx vitest run tests/components/SettingsMenu.test.ts tests/components/App.test.ts -t 'chain'`
Expected: both FAIL (no radio group yet).

- [ ] **Step 3: SettingsMenu markup**

Extend the chainpalette import to `import { CHAIN_COLORS, CHAIN_PALETTE, type ChainColor } from '../lib/chainpalette'` and add in the script:

```ts
const CHAIN_OPTION_KEYS = {
  amber: 'chainAmber',
  green: 'chainGreen',
  violet: 'chainViolet',
  none: 'chainNone',
} as const
```

Replace the whole chain `.row` div (label + select) with:

```svelte
<fieldset class="row chain-row">
  <legend class="row-label">{t('chainLabel')}</legend>
  <div class="swatches">
    {#each CHAIN_COLORS as c (c)}
      <input
        class="swatch-input"
        type="radio"
        id="chain-{c}-{uid}"
        name="chain-{uid}"
        value={c}
        bind:group={chainColor}
        aria-label={t(CHAIN_OPTION_KEYS[c])}
      />
      <label
        class="swatch"
        class:swatch-none={c === 'none'}
        for="chain-{c}-{uid}"
        title={t(CHAIN_OPTION_KEYS[c])}
        style={c !== 'none' ? `--sw: ${CHAIN_PALETTE[c].line}; --sw-soft: ${CHAIN_PALETTE[c].soft}` : undefined}
      ></label>
    {/each}
  </div>
</fieldset>
```

- [ ] **Step 4: CSS**

Append to `src/app.css` after the existing `.settings-popup` rules:

```css
/* chain-color swatches: each tile is a miniature of the chain box styling */
.settings-popup .chain-row { border: none; margin: 0; padding: 0; }
.settings-popup .chain-row legend { padding: 0; }
.settings-popup .swatches { display: flex; gap: 10px; margin-top: 0.25rem; }
.settings-popup .swatch { width: 28px; height: 28px; border-radius: 6px; background: var(--sw-soft); border: 2px solid var(--sw); cursor: pointer; }
.settings-popup .swatch-none { background: linear-gradient(135deg, transparent 44%, var(--danger) 44%, var(--danger) 56%, transparent 56%), #fff; border: 1px solid var(--box-stroke); }
.settings-popup .swatch-input { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); border: 0; }
.settings-popup .swatch-input:checked + .swatch, .settings-popup .swatch-input:focus-visible + .swatch { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 5: Run the affected suites, then the full check**

Run: `npx vitest run tests/components/SettingsMenu.test.ts tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings (an a11y warning about the empty label would be a finding — the `for`/`title` association should satisfy svelte-check; report if not).

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsMenu.svelte src/app.css src/lib/locales tests/components/SettingsMenu.test.ts tests/components/App.test.ts
git commit -m "feat: chain color as swatch radio group, label renamed to predicate"
```
