import { en } from './locales/en'
import { de } from './locales/de'
import { ja } from './locales/ja'
import { zh } from './locales/zh'

export type Locale = 'en' | 'de' | 'ja' | 'zh'
export type MessageKey = keyof typeof en

export const SUPPORTED_LOCALES: Locale[] = ['en', 'de', 'ja', 'zh']

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, de, ja, zh }

export function resolveLocale(
  stored: Locale | null,
  languages: readonly string[] = globalThis.navigator?.languages ?? [],
): Locale {
  if (stored) return stored
  for (const lang of languages) {
    const match = SUPPORTED_LOCALES.find((l) => lang.toLowerCase().startsWith(l))
    if (match) return match
  }
  return 'en'
}

const state = $state({ locale: resolveLocale(null) })

export function setStoredLocale(stored: Locale | null): void {
  state.locale = resolveLocale(stored)
  if (typeof document !== 'undefined') document.documentElement.lang = state.locale
}

export function currentLocale(): Locale {
  return state.locale
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let msg = catalogs[state.locale][key]
  if (params) {
    for (const [k, v] of Object.entries(params)) msg = msg.replaceAll(`{${k}}`, String(v))
  }
  return msg
}
