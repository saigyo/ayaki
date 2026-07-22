import { chromium } from 'playwright'

// Post-deploy verification against the live site (read-only, no repo writes).
// `npm run live-check` → production; `npm run live-check -- <url>` → any deploy.

const target = process.argv[2] ?? 'https://saigyo.github.io/ayaki/'
const failures = []
const ok = (name) => console.log(`ok ${name}`)
const fail = (name, detail) => {
  failures.push(name)
  console.log(`FAIL ${name}: ${detail}`)
}

const browser = await chromium.launch({ headless: true })
// pin the locale: the label assertions (view buttons, locale options) are the
// English UI, independent of the machine the check runs on
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, locale: 'en-US' })
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

try {
  let booted = false
  try {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.getByTestId('example-link').waitFor({ timeout: 10_000 })
    booted = true
    ok('boot: page loads, example link present')
  } catch (e) {
    fail('boot', String(e))
  }

  if (booted) {
    try {
      const idle = await page.evaluate(() => ({
        results: !!document.querySelector('main .results'),
        entry: !!document.querySelector('main .entry .sentence-input'),
        rules: document.querySelectorAll('hr.rule').length,
      }))
      if (idle.results || !idle.entry || idle.rules !== 1) throw new Error(JSON.stringify(idle))
      ok('layout idle: entry band, one rule, no results grid')
    } catch (e) {
      fail('layout idle', String(e))
    }

    try {
      await page.getByTestId('example-link').click()
      // scope to main: the help dialog's demo StairView in <header> always exists in the DOM
      await page.waitForSelector('main g.bunsetsu', { timeout: 60_000 })
      ok(`parse: example renders ${await page.locator('main g.bunsetsu').count()} bunsetsu`)
    } catch (e) {
      fail('parse', String(e))
    }

    try {
      const geo = await page.evaluate(() => {
        const r = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null
        const card = r('main .results .card')
        const insp = r('main .results .inspector')
        const ta = r('main .entry .sentence-input textarea')
        const btn = r('main .entry .sentence-input button')
        if (!card || !insp || !ta || !btn) return null
        const contentWidth = insp.right - card.left
        return {
          inspectorNotAboveCard: insp.top >= card.top - 2,
          buttonTopAligned: Math.abs(btn.top - ta.top) <= 4,
          inputSpansWidth: ta.width >= contentWidth * 0.7,
          rules: document.querySelectorAll('hr.rule').length,
        }
      })
      if (!geo || !geo.inspectorNotAboveCard || !geo.buttonTopAligned || !geo.inputSpansWidth || geo.rules !== 2)
        throw new Error(JSON.stringify(geo))
      ok('layout: full-width input, top-aligned button, inspector level with first card, two rules')
    } catch (e) {
      fail('layout', String(e))
    }

    const views = [
      { label: 'arcs', name: /arcs/, sel: 'svg.arcdiagram path.arc' },
      { label: 'tree', name: /tree/, sel: 'svg line.edge' },
      { label: 'cabocha', name: /CaboCha/, sel: 'main svg.stairview path.arc' },
    ]
    for (const v of views) {
      try {
        await page.getByRole('button', { name: v.name }).click()
        await page.waitForSelector(v.sel, { timeout: 10_000 })
        ok(`view ${v.label}: ${v.sel} present`)
      } catch (e) {
        fail(`view ${v.label}`, String(e))
      }
    }

    try {
      const globe = await page.evaluate(() => {
        const sel = document.querySelector('header .brand .locale-switcher select')
        return {
          options: sel ? [...sel.options].map((o) => o.textContent) : null,
          toolbarLocaleControls: document.querySelectorAll('.toolbar select.locale, .toolbar .locale-wrap').length,
        }
      })
      const expected = ['Auto (browser)', 'English', 'Deutsch', '日本語', '中文']
      if (JSON.stringify(globe.options) === JSON.stringify(expected) && globe.toolbarLocaleControls === 0)
        ok('globe: header switcher with 5 options, none in toolbar')
      else fail('globe', JSON.stringify(globe))
    } catch (e) {
      fail('globe', String(e))
    }

    try {
      await page.selectOption('header .brand .locale-switcher select', 'de')
      const lang = await page.evaluate(() => document.documentElement.lang)
      const parseLabel = await page.locator('.sentence-input button').textContent()
      if (lang !== 'de' || !/Analysieren/.test(parseLabel ?? '')) throw new Error(`lang=${lang} button=${parseLabel}`)
      await page.reload({ waitUntil: 'networkidle' })
      const persisted = await page.locator('header .locale-switcher select').inputValue()
      if (persisted !== 'de') throw new Error(`stored locale after reload: ${persisted}`)
      await page.selectOption('header .brand .locale-switcher select', '')
      ok('locale: de switch + reload persistence + reset to auto')
    } catch (e) {
      fail('locale', String(e))
    }

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

    try {
      if ((await page.locator('main g.bunsetsu').count()) === 0) {
        // the locale check's reload above cleared the loaded sentence — restore it
        await page.getByTestId('example-link').click()
        await page.waitForSelector('main g.bunsetsu', { timeout: 60_000 })
      }
      await page.locator('main g.bunsetsu').first().click()
      await page.waitForSelector('.inspector .part', { timeout: 5_000 })
      const parts = await page.locator('.inspector .part').count()
      const entries = await page.locator('.inspector .morpheme').count()
      const labels = await page.locator('.inspector .part-label').count()
      if (parts < 2 || parts !== entries || labels !== parts)
        throw new Error(`parts=${parts} entries=${entries} labels=${labels}`)
      await page.keyboard.press('Escape')
      ok(`parts: segmented heading with ${parts} labeled parts matching ${entries} entries`)
    } catch (e) {
      fail('parts', String(e))
    }

    try {
      const labels = await page.locator('main .relation-label').allTextContents()
      const onEdge = await page.locator('main .relation-label.on-edge').count()
      // arrows default: 6 edge labels + 3 predicate badges (main + 2 clause heads)
      if (labels.length !== 9 || onEdge !== 6) throw new Error(`labels=${labels.length} onEdge=${onEdge}`)
      if (!labels.includes('object') || !labels.includes('main predicate'))
        throw new Error(`unexpected label texts: ${labels.join(',')}`)
      // selecting the linked-clause bunsetsu (見に) draws the extent bracket
      await page.locator('main g.bunsetsu').nth(5).click()
      await page.waitForSelector('main .extent-bracket', { timeout: 5_000 })
      await page.keyboard.press('Escape')
      ok('relations: 6 arrow labels + 3 predicate badges, extent bracket on 見に')
    } catch (e) {
      fail('relations', String(e))
    }

    try {
      // the views check above stored 'cabocha' via real clicks — capture it,
      // open a *tree* share link, and assert the store is untouched
      const viewBefore = await page.evaluate(
        () => JSON.parse(localStorage.getItem('ayaki-settings') ?? '{}').view ?? null,
      )
      const share = new URL(target)
      share.searchParams.set('text', '猫が魚を食べた。')
      share.searchParams.set('view', 'tree')
      share.searchParams.set('s', '0')
      share.searchParams.set('b', '1')
      await page.goto(share.toString(), { waitUntil: 'networkidle' })
      await page.waitForSelector('main g.bunsetsu', { timeout: 60_000 })
      const state = await page.evaluate(() => ({
        tree: !!document.querySelector('main svg line.edge'),
        selected: document.querySelector('main g.bunsetsu.selected')?.getAttribute('aria-label') ?? null,
        storedView: JSON.parse(localStorage.getItem('ayaki-settings') ?? '{}').view ?? null,
      }))
      if (!state.tree || state.selected !== '魚を' || state.storedView !== viewBefore)
        throw new Error(`before=${viewBefore} after=${JSON.stringify(state)}`)
      ok('share: link opens tree with 魚を selected, stored view untouched')
    } catch (e) {
      fail('share', String(e))
    }

    try {
      const jump = new URL(target)
      jump.searchParams.set('text', '猫が魚を食べた。犬は公園で遊んだ。')
      jump.searchParams.set('view', 'arcs')
      jump.searchParams.set('s', '1')
      jump.searchParams.set('b', '1')
      // a viewport too small for two cards — the scroll must actually happen
      const small = await browser.newPage({ viewport: { width: 900, height: 300 }, locale: 'en-US' })
      try {
        await small.goto(jump.toString(), { waitUntil: 'networkidle' })
        await small.waitForFunction(() => document.querySelectorAll('.card-slot').length === 2, null, { timeout: 60_000 })
        // wait on the terminal conditions themselves, not a fixed sleep — slow
        // hosts may legitimately take longer than any guessed delay
        await small.waitForFunction(
          () => {
            const slot = document.querySelectorAll('.card-slot')[1]
            if (!slot) return false
            const card = slot.getBoundingClientRect()
            return (
              document.querySelector('main g.bunsetsu.selected')?.getAttribute('aria-label') === '公園で' &&
              (document.querySelectorAll('.card')[1]?.classList.contains('active') ?? false) &&
              card.top < 300 &&
              card.bottom > 0 &&
              window.scrollY > 0
            )
          },
          null,
          { timeout: 10_000 },
        )
        const state = await small.evaluate(() => {
          const card = document.querySelectorAll('.card-slot')[1].getBoundingClientRect()
          return {
            selected: document.querySelector('main g.bunsetsu.selected')?.getAttribute('aria-label') ?? null,
            active: document.querySelectorAll('.card')[1]?.classList.contains('active') ?? false,
            top: Math.round(card.top),
            bottom: Math.round(card.bottom),
            scrollY: Math.round(window.scrollY),
          }
        })
        // intersection, not full fit: a card taller than the viewport is still
        // correctly scrolled to as long as it overlaps and scrollY moved
        if (state.selected !== '公園で' || !state.active || state.top >= 300 || state.bottom <= 0 || state.scrollY <= 0)
          throw new Error(JSON.stringify(state))
        ok('share jump: s=1 card scrolled into a 300px viewport')
      } finally {
        await small.close()
      }
    } catch (e) {
      fail('share jump', String(e))
    }
  }

  if (consoleErrors.length === 0) ok('console: no errors')
  else fail('console', `${consoleErrors.length} error(s): ${consoleErrors.slice(0, 3).join(' | ')}`)
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.log(`live-check FAILED (${failures.length}): ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('live-check passed')
}
