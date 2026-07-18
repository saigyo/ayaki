import { describe, expect, it } from 'vitest'
import { googleTranslateUrl, jishoUrl } from '../../src/lib/links'

describe('links', () => {
  it('builds an encoded Jisho search URL', () => {
    expect(jishoUrl('見る')).toBe('https://jisho.org/search/%E8%A6%8B%E3%82%8B')
  })
  it('builds a Google Translate URL ja→en', () => {
    const url = googleTranslateUrl('猫が来た。')
    expect(url).toContain('translate.google.com')
    expect(url).toContain('sl=ja')
    expect(url).toContain('tl=en')
    expect(url).toContain(encodeURIComponent('猫が来た。'))
  })
})
