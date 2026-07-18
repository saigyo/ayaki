import { loadParser, type Parser } from 'sasara'
import { errorSentence, toParsedSentence } from './viewmodel'
import type { ParsedSentence } from './types'

/** Split text into single sentences for sasara (which only accepts one sentence). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

let parserPromise: Promise<Parser> | null = null
let ready = false

export function parserReady(): boolean {
  return ready
}

async function initParser(): Promise<Parser> {
  const base = import.meta.env.BASE_URL
  const res = await fetch(`${base}model.json`)
  if (!res.ok) throw new Error(`Failed to load model.json (HTTP ${res.status})`)
  const model = await res.json()
  const parser = await loadParser({ model, dicPath: `${base}dict/` })
  ready = true
  return parser
}

/** Lazy, cached parser init. A failed init is not cached, so a retry re-attempts. */
function getParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = initParser().catch((e) => {
      parserPromise = null
      throw e
    })
  }
  return parserPromise
}

export async function parseTextWith(parser: Parser, text: string): Promise<ParsedSentence[]> {
  const out: ParsedSentence[] = []
  for (const sentence of splitSentences(text)) {
    try {
      out.push(toParsedSentence(sentence, await parser.parse(sentence, true)))
    } catch (e) {
      out.push(errorSentence(sentence, e instanceof Error ? e.message : String(e)))
    }
  }
  return out
}

/** Browser entry point: initializes assets on first call, then parses. */
export async function parseText(text: string): Promise<ParsedSentence[]> {
  return parseTextWith(await getParser(), text)
}
