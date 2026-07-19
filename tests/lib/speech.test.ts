import { afterEach, describe, expect, it, vi } from 'vitest'
import { listJaVoices, pickVoice, speak, speechAvailable, stopSpeech } from '../../src/lib/speech'

class FakeUtterance {
  text: string
  voice: unknown = null
  lang = ''
  rate = 1
  addEventListener = vi.fn()
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
  it('lists Japanese voices localService-first then alphabetical', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'ja-JP', localService: false, name: 'Zulu', voiceURI: 'zulu' },
        { lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' },
        { lang: 'ja-JP', localService: true, name: 'Otoya', voiceURI: 'otoya' },
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
      ]),
    )
    expect(listJaVoices().map((v) => v.name)).toEqual(['Kyoko', 'Otoya', 'Cloud', 'Zulu'])
  })
  it('pickVoice honors a preferred voiceURI and falls back when missing', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
      ]),
    )
    expect(pickVoice('cloud')?.name).toBe('Cloud')
    expect(pickVoice('gone')?.name).toBe('Kyoko')
    expect(pickVoice(null)?.name).toBe('Kyoko')
  })
  it('pickVoice ignores a preferred URI belonging to a non-Japanese voice', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' },
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
      ]),
    )
    expect(pickVoice('sam')?.name).toBe('Kyoko')
  })
  it('speak applies the preferred voice to the utterance', () => {
    const synth = fakeSynth([
      { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
      { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
    ])
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    speak('こんにちは', 1, 'cloud')
    const u = synth.speak.mock.calls[0][0] as FakeUtterance
    expect((u.voice as SpeechSynthesisVoice).name).toBe('Cloud')
  })
  it('speak registers onDone for both the end and error events', () => {
    const synth = fakeSynth([{ lang: 'ja-JP', localService: true, name: 'Kyoko' }])
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    const onDone = vi.fn()
    speak('こんにちは', 1, null, onDone)
    const u = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(u.addEventListener).toHaveBeenCalledWith('end', onDone)
    expect(u.addEventListener).toHaveBeenCalledWith('error', onDone)
  })
})
