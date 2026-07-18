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

function applyField<K extends keyof Settings>(target: Settings, key: K, raw: unknown): void {
  const value = validators[key](raw)
  if (value !== undefined) target[key] = value
}

export function loadSettings(): Settings {
  const settings = { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return settings
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return settings
    }
    const obj = parsed as Record<string, unknown>
    for (const key of Object.keys(validators) as (keyof Settings)[]) {
      applyField(settings, key, obj[key])
    }
    return settings
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
