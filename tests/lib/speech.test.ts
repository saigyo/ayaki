import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickVoice, speak, speechAvailable, stopSpeech } from '../../src/lib/speech'

class FakeUtterance {
  text: string
  voice: unknown = null
  lang = ''
  rate = 1
  constructor(text: string) {
    this.text = text
  }
}

function fakeSynth(voices: Array<Partial<SpeechSynthesisVoice>>) {
  return {
    getVoices: () => voices as SpeechSynthesisVoice[],
    cancel: vi.fn(),
    speak: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('speech', () => {
  it('prefers a local Japanese voice and ignores other languages', () => {
    const synth = fakeSynth([
      { lang: 'en-US', localService: true, name: 'Samantha' },
      { lang: 'ja-JP', localService: false, name: 'Cloud' },
      { lang: 'ja-JP', localService: true, name: 'Kyoko' },
    ])
    vi.stubGlobal('speechSynthesis', synth)
    expect(pickVoice()?.name).toBe('Kyoko')
    expect(speechAvailable()).toBe(true)
  })
  it('falls back to a remote Japanese voice', () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'ja-JP', localService: false, name: 'Cloud' }]))
    expect(pickVoice()?.name).toBe('Cloud')
  })
  it('is unavailable without Japanese voices or without the API', () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'en-US', localService: true, name: 'Samantha' }]))
    expect(speechAvailable()).toBe(false)
    vi.unstubAllGlobals()
    expect(speechAvailable()).toBe(false)
  })
  it('speak cancels the previous utterance and applies rate and lang', () => {
    const synth = fakeSynth([{ lang: 'ja-JP', localService: true, name: 'Kyoko' }])
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    speak('こんにちは', 0.8)
    expect(synth.cancel).toHaveBeenCalledOnce()
    expect(synth.speak).toHaveBeenCalledOnce()
    const u = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(u.text).toBe('こんにちは')
    expect(u.rate).toBe(0.8)
    expect(u.lang).toBe('ja-JP')
    expect((u.voice as SpeechSynthesisVoice).name).toBe('Kyoko')
  })
  it('stopSpeech cancels, and both are no-ops without the API', () => {
    const synth = fakeSynth([])
    vi.stubGlobal('speechSynthesis', synth)
    stopSpeech()
    expect(synth.cancel).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
    expect(() => {
      speak('x')
      stopSpeech()
    }).not.toThrow()
  })
})
