import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

// Regenerates ALL three README screenshots. Every screenshot shows the app
// chrome (header/toolbar), so any chrome change invalidates the whole set —
// always rerun this script as a whole, never refresh a single shot.
// `npm run shots` (preshots builds dist/ first so shots are never stale).

const PORT = 5399
const base = `http://localhost:${PORT}/ayaki/`
const server = spawn('npx', ['vite', 'preview', '--base=/ayaki/', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] })
let browser

let serverOutput = ''
server.stdout.on('data', (d) => (serverOutput += d.toString()))
server.stderr.on('data', (d) => (serverOutput += d.toString()))

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base)
      if (r.status < 500) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`preview server did not come up\n${serverOutput}`)
}

// fresh context per scene: clean localStorage, stubbed ja voice so the
// toolbar voice selector renders, README's canonical viewport
async function freshPage(browser) {
  // locale pinned: README screenshots are canonically the English UI,
  // regardless of the machine's system locale
  const page = await browser.newPage({ viewport: { width: 1200, height: 660 }, deviceScaleFactor: 2, locale: 'en-US' })
  await page.addInitScript(() => {
    const voices = [
      { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'com.apple.voice.compact.ja-JP.Kyoko', default: false },
    ]
    speechSynthesis.getVoices = () => voices
  })
  await page.goto(base)
  return page
}

async function shoot(page, path) {
  await page.mouse.move(0, 0)
  await page.screenshot({ path })
  console.log(`written ${path}`)
  await page.context().close()
}

try {
  await waitForServer()
  browser = await chromium.launch({ headless: true })

  // scene 1: arcs view, two sentences, no selection
  let page = await freshPage(browser)
  await page.getByRole('textbox').fill('猫が魚を食べた。犬は公園で遊んだ。')
  await page.getByRole('button', { name: /parse/i }).click()
  // scope to main: the help dialog's demo StairView in <header> always exists in the DOM
  await page.waitForSelector('main g.bunsetsu', { timeout: 60_000 })
  await shoot(page, 'docs/images/screenshot.png')

  // scene 2: tree view, built-in example, furigana on, 映画を selected
  page = await freshPage(browser)
  await page.getByTestId('example-link').click()
  await page.waitForSelector('main g.bunsetsu', { timeout: 60_000 })
  await page.getByRole('button', { name: /tree/ }).click()
  await page.waitForSelector('svg line.edge')
  await page.getByRole('checkbox', { name: /furigana/ }).check()
  await page.getByRole('button', { name: '映画を' }).click()
  await page.waitForSelector('.morpheme')
  await shoot(page, 'docs/images/screenshot-tree.png')

  // scene 3: cabocha view, built-in example, 映画を selected, furigana off
  page = await freshPage(browser)
  await page.getByTestId('example-link').click()
  await page.waitForSelector('main g.bunsetsu', { timeout: 60_000 })
  await page.getByRole('button', { name: /CaboCha/ }).click()
  await page.waitForSelector('main svg.stairview path.arc')
  await page.getByRole('button', { name: '映画を' }).click()
  await page.waitForSelector('.morpheme')
  await shoot(page, 'docs/images/screenshot-cabocha.png')

  await browser.close()
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
