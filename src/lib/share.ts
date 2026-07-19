import type { ViewKind } from './settings'

export interface ShareParams {
  text: string
  view: ViewKind | null
  sentence: number | null
  bunsetsu: number | null
}

/** base is location.origin + location.pathname (keeps /ayaki/ and preview ports) */
export function buildShareUrl(
  base: string,
  text: string,
  view: ViewKind,
  sentence: number | null,
  bunsetsu: number | null,
): string {
  const p = new URLSearchParams()
  p.set('text', text)
  p.set('view', view)
  if (bunsetsu !== null) {
    p.set('s', String(sentence ?? 0))
    p.set('b', String(bunsetsu))
  } else if (sentence !== null && sentence > 0) {
    p.set('s', String(sentence))
  }
  return `${base}?${p.toString()}`
}

export function parseShareParams(search: string): ShareParams | null {
  const p = new URLSearchParams(search)
  const text = p.get('text')
  if (!text || !text.trim()) return null
  const rawView = p.get('view')
  const view = rawView === 'arcs' || rawView === 'tree' || rawView === 'cabocha' ? rawView : null
  const idx = (raw: string | null) => (raw !== null && /^\d+$/.test(raw) ? Number(raw) : null)
  const bunsetsu = idx(p.get('b'))
  // b defaults its sentence to 0 when s is absent
  const sentence = idx(p.get('s')) ?? (bunsetsu !== null ? 0 : null)
  return { text, view, sentence, bunsetsu }
}
