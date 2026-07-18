export interface Settings {
  showFurigana: boolean
  view: 'arcs' | 'tree'
  rate: number
}

export const DEFAULTS: Settings = { showFurigana: false, view: 'arcs', rate: 1 }

const KEY = 'ayaki-settings'
const RATE_MIN = 0.5
const RATE_MAX = 1.5

/** One validator per field: returns the (normalized) value, or undefined to fall
 *  back to that field's default. Future fields (voiceURI, locale) are added here. */
const validators: { [K in keyof Settings]: (v: unknown) => Settings[K] | undefined } = {
  showFurigana: (v) => (typeof v === 'boolean' ? v : undefined),
  view: (v) => (v === 'arcs' || v === 'tree' ? v : undefined),
  rate: (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(RATE_MAX, Math.max(RATE_MIN, v))
      : undefined,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULTS }
    }
    const obj = parsed as Record<string, unknown>
    return {
      showFurigana: validators.showFurigana(obj.showFurigana) ?? DEFAULTS.showFurigana,
      view: validators.view(obj.view) ?? DEFAULTS.view,
      rate: validators.rate(obj.rate) ?? DEFAULTS.rate,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // best-effort: private mode, quota, or disabled storage — never break the app
  }
}
