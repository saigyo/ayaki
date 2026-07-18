// Browser-level regression guard: builds are useless if the bundle doesn't actually run in a
// browser. The unit suite mocks/stubs its way around real bundling, kuromoji/zlibjs shims and
// asset loading, so it is structurally blind to breakage in those seams. This script drives a
// real Chromium against `vite preview` over the *built* dist/ and exercises the first parse
// end-to-end (dictionary download included).
//
// Usage: npm run build -- --base=/ayaki/ && npm run smoke

import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 5299
const BASE = '/ayaki/'
const URL = `http://localhost:${PORT}${BASE}`
const SERVER_TIMEOUT_MS = 20_000
const PARSE_TIMEOUT_MS = 60_000
const MIN_BUNSETSU = 5

let server = null
let browser = null
let exitCode = 0

function log(...args) {
  console.log('[smoke]', ...args)
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`vite preview did not respond at ${url} within ${timeoutMs}ms`)
}

async function main() {
  log(`starting vite preview --base=${BASE} --port ${PORT}`)
  server = spawn('npx', ['vite', 'preview', `--base=${BASE}`, '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverOutput = ''
  server.stdout.on('data', (d) => (serverOutput += d.toString()))
  server.stderr.on('data', (d) => (serverOutput += d.toString()))
  server.on('exit', (code) => {
    if (code !== null && code !== 0 && !browser) {
      log(`preview server exited early with code ${code}:\n${serverOutput}`)
    }
  })

  await waitForServer(URL, SERVER_TIMEOUT_MS)
  log('preview server is up')

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err))
  })

  log(`opening ${URL}`)
  await page.goto(URL, { waitUntil: 'load' })

  log('clicking example link')
  await page.getByTestId('example-link').click()

  log(`waiting up to ${PARSE_TIMEOUT_MS}ms for g.bunsetsu elements (first parse downloads the dictionary)`)
  await page.waitForSelector('g.bunsetsu', { timeout: PARSE_TIMEOUT_MS })

  const bunsetsuCount = await page.locator('g.bunsetsu').count()

  const failures = []
  if (bunsetsuCount < MIN_BUNSETSU) {
    failures.push(`expected at least ${MIN_BUNSETSU} g.bunsetsu groups, found ${bunsetsuCount}`)
  }
  if (consoleErrors.length > 0) {
    failures.push(`expected zero console errors, found ${consoleErrors.length}:\n  ${consoleErrors.join('\n  ')}`)
  }

  if (failures.length > 0) {
    log('FAIL')
    for (const f of failures) log(' -', f)
    exitCode = 1
  } else {
    log('PASS')
    log(` - g.bunsetsu groups: ${bunsetsuCount}`)
    log(' - console errors: 0')
  }
}

async function cleanup() {
  if (browser) {
    await browser.close().catch(() => {})
  }
  if (server) {
    server.kill()
  }
}

main()
  .catch((e) => {
    log('FAIL —', e instanceof Error ? e.stack : String(e))
    exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    process.exit(exitCode)
  })
