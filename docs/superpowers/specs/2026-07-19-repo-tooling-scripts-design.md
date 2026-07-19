# Repo Tooling Scripts (Screenshots + Live Check) — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

Two recurring maintenance jobs are currently done with ad-hoc Playwright scripts
kept in the session temp folder, where they get lost between sessions (the
screenshot script had to be reconstructed from a conversation transcript once
already):

1. Regenerating the README screenshots after UI changes. All three screenshots
   show the app chrome, so any header/toolbar change invalidates the full set —
   demonstrated by PR #13, which refreshed only the arcs shot and left the tree
   and CaboCha shots showing the removed toolbar locale select (debt this
   iteration retires).
2. Verifying a deploy live in production as the final step of the post-merge
   routine (currently hand-written DOM probes each time).

Both belong in `scripts/`, versioned, next to the existing `browser-smoke.mjs`,
which sets the house pattern: plain `.mjs`, Playwright from devDependencies,
spawn `vite preview --base=/ayaki/` on a fixed port, wait for the server,
non-zero exit on failure.

## Script 1 — `scripts/readme-shots.mjs` (`npm run shots`)

Regenerates all three README screenshots in one run against a local production
build.

- **Build freshness:** a `preshots` npm hook runs
  `npm run build -- --base=/ayaki/` first. A forgotten build would produce
  silently stale screenshots — the exact failure mode this tooling exists to
  prevent — so the script never trusts an existing `dist/`.
- **Common fixtures:** viewport 1200×660, `deviceScaleFactor: 2` (matches the
  existing screenshots' 2400px width); `speechSynthesis.getVoices` stubbed via
  `addInitScript` with one `ja-JP` voice so the toolbar voice selector renders;
  mouse parked at (0,0) before each shot so no hover styling leaks in.
- **Scene isolation:** each scene runs on a fresh page (fresh browser context)
  so localStorage/settings never bleed between scenes. Views and toggles are
  driven through the real UI (toolbar buttons, furigana checkbox, bunsetsu
  clicks), not injected state.
- **Scenes** (canonical set going forward):
  1. `docs/images/screenshot.png` — arcs view, two-sentence input
     `猫が魚を食べた。犬は公園で遊んだ。` typed and parsed, no bunsetsu
     selected. (The scene shipped in PR #13.)
  2. `docs/images/screenshot-tree.png` — built-in example
     (`昨日、私は友達と新しい映画を見に行きました。` via the example link),
     tree view, furigana on, bunsetsu `映画を` selected (matches the current
     alt text: inspector shows the bunsetsu's morphemes).
  3. `docs/images/screenshot-cabocha.png` — built-in example, CaboCha view,
     `映画を` selected, furigana off.
- Waits: after parse, wait for `g.bunsetsu`; after selection, wait for
  `.morpheme` in the inspector. Prints one `written <path>` line per shot.
- English UI assumed (headless Chromium defaults to `en-US`; scenes never set
  a locale).

## Script 2 — `scripts/live-check.mjs` (`npm run live-check [url]`)

Post-deploy verification against production; the standing final step of the
post-merge routine.

- **Target:** first CLI argument, default `https://saigyo.github.io/ayaki/`
  (`npm run live-check -- <url>` to test a preview deploy or local server).
- **Checks**, each printed as its own `ok <check>` line, any failure printing
  `FAIL <check>: <detail>` and exiting 1 at the end (all checks run even after
  a failure, so one run reports everything):
  1. Page loads (networkidle) and the example link
     (`data-testid="example-link"`) is present.
  2. Clicking the example link parses: `g.bunsetsu` count > 0 within 60 s
     (dictionary download allowed for).
  3. Each of the three view buttons switches to its view: arcs → `path.arc`
     present, tree → `line.edge` present, CaboCha → stair layout's connector
     paths present (the view's `role="group"` SVG in all cases).
  4. Header globe: `header .brand .locale-switcher select` exists, has exactly
     the five options (Auto + en/de/ja/zh endonyms), and the toolbar contains
     no locale select.
  5. Locale round-trip: select `de` → chrome flips (`html[lang="de"]`, Parse
     button reads `Analysieren`) and the choice persists across a reload; then
     reset to Auto so the check leaves no trace in the tester's own browser
     state (headless profile anyway, but the reset keeps the check idempotent).
  6. Zero console errors collected across the whole run.
- No screenshots, no writes to the repo — read-only against the live site.

## `package.json`

```json
"preshots": "npm run build -- --base=/ayaki/",
"shots": "node scripts/readme-shots.mjs",
"live-check": "node scripts/live-check.mjs"
```

## README

- Development section gains one bullet per script (what it does, when to run
  it): `npm run shots` after UI-visible changes — regenerates all three
  screenshots, since every screenshot shows the chrome; `npm run live-check`
  after a deploy.
- Alt texts updated only where a regenerated scene differs from the current
  description (expected: none — scenes were chosen to match).

## Error handling

| Situation | Behavior |
| --- | --- |
| Preview server fails to boot (shots) | timeout after ~15 s, non-zero exit (same as browser-smoke) |
| Selector never appears (parse failure, renamed testid) | Playwright timeout fails that scene/check, non-zero exit |
| Live site unreachable | goto fails, `FAIL` line, exit 1 |
| Live-check finds console errors | listed in the failure output |

## Not changing

`scripts/browser-smoke.mjs`, `scripts/sync-assets.mjs`, CI workflows (neither
new script runs in CI: shots writes to the working tree, live-check targets
production — both are operator tools).

## Testing

The scripts are executable checks; running them is their test. Validation for
this iteration:

1. `npm run shots` — regenerates all three PNGs; visually verify each scene
   (globe in header, no toolbar locale select, correct view + selection), then
   commit the refreshed set. This retires the PR #13 screenshot debt.
2. `npm run live-check` — passes against production (currently at the
   header-locale-switcher deploy).
3. `npm run live-check -- http://localhost:<port>/ayaki/` — sanity-run against
   the local preview the shots script uses, confirming the URL override works.
