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

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})

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
      await page.getByTestId('example-link').click()
      await page.waitForSelector('g.bunsetsu', { timeout: 60_000 })
      ok(`parse: example renders ${await page.locator('g.bunsetsu').count()} bunsetsu`)
    } catch (e) {
      fail('parse', String(e))
    }

    const views = [
      { label: 'arcs', name: /arcs/, sel: 'svg.arcdiagram path.arc' },
      { label: 'tree', name: /tree/, sel: 'svg line.edge' },
      { label: 'cabocha', name: /CaboCha/, sel: 'svg.stairview path.arc' },
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
