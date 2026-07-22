import { SUPPORTED_LOCALES, type Locale } from './i18n.svelte'
import { CHAIN_COLORS, type ChainColor } from './chainpalette'

export type ViewKind = 'arcs' | 'tree' | 'cabocha'
export type RelationDisplay = 'off' | 'badges' | 'arrows'
export type ArrowDirection = 'ud' | 'kakariuke'

const RELATION_DISPLAYS: readonly RelationDisplay[] = ['off', 'badges', 'arrows']
const ARROW_DIRECTIONS: readonly ArrowDirection[] = ['ud', 'kakariuke']

export interface Settings {
  showFurigana: boolean
  showConfidence: boolean
  confidenceThreshold: number
  quietParts: boolean
  relationDisplay: RelationDisplay
  arrowDirection: ArrowDirection
  view: ViewKind
  rate: number
  voiceURI: string | null
  locale: Locale | null
  chainColor: ChainColor
}

export const DEFAULTS: Settings = { showFurigana: false, showConfidence: false, confidenceThreshold: 0.7, quietParts: false, relationDisplay: 'arrows', arrowDirection: 'ud', view: 'arcs', rate: 1, voiceURI: null, locale: null, chainColor: 'amber' }

const KEY = 'ayaki-settings'
const RATE_MIN = 0.5
const RATE_MAX = 1.5
export const CONFIDENCE_MIN = 0.6
export const CONFIDENCE_MAX = 0.9

/** One validator per field: returns the (normalized) value, or undefined to fall
 *  back to that field's default. Future fields are added here. */
const validators: { [K in keyof Settings]: (v: unknown) => Settings[K] | undefined } = {
  showFurigana: (v) => (typeof v === 'boolean' ? v : undefined),
  showConfidence: (v) => (typeof v === 'boolean' ? v : undefined),
  confidenceThreshold: (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, v))
      : undefined,
  quietParts: (v) => (typeof v === 'boolean' ? v : undefined),
  relationDisplay: (v) => (RELATION_DISPLAYS.includes(v as RelationDisplay) ? (v as RelationDisplay) : undefined),
  arrowDirection: (v) => (ARROW_DIRECTIONS.includes(v as ArrowDirection) ? (v as ArrowDirection) : undefined),
  chainColor: (v) => (CHAIN_COLORS.includes(v as ChainColor) ? (v as ChainColor) : undefined),
  view: (v) => (v === 'arcs' || v === 'tree' || v === 'cabocha' ? v : undefined),
  rate: (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(RATE_MAX, Math.max(RATE_MIN, v))
      : undefined,
  // '' is rejected so the two spellings of "auto" normalize to the canonical null
  voiceURI: (v) => (v === null || (typeof v === 'string' && v !== '') ? v : undefined),
  locale: (v) => (v === null || SUPPORTED_LOCALES.includes(v as Locale) ? (v as Locale | null) : undefined),
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
    // pre-arrows migration: the boolean showRelations became relationDisplay;
    // an invalid stored relationDisplay counts as missing so the legacy flag still applies
    if (validators.relationDisplay(obj.relationDisplay) === undefined && typeof obj.showRelations === 'boolean') {
      settings.relationDisplay = obj.showRelations ? 'arrows' : 'off'
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
