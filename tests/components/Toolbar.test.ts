// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import Toolbar from '../../src/components/Toolbar.svelte'
import { setStoredLocale } from '../../src/lib/i18n.svelte'

const base = { showFurigana: false, view: 'arcs' as const, rate: 1 }

function fakeSynth(voices: Array<Partial<SpeechSynthesisVoice>>) {
  return {
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Toolbar voice selector', () => {
  it('renders auto plus the Japanese voices in order', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
        { lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' },
      ]),
    )
    render(Toolbar, { props: { ...base, voiceURI: null } })
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    const labels = [...select.options].map((o) => o.textContent)
    expect(labels).toEqual(['auto', 'Kyoko', 'Cloud'])
    expect(select.value).toBe('')
  })
  it('is hidden when there are no Japanese voices', () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' }]))
    render(Toolbar, { props: { ...base, voiceURI: null } })
    expect(screen.queryByRole('combobox', { name: 'voice' })).toBeNull()
  })
  it('shows the stored voice when present, auto when absent — without clearing it', () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }]))
    const present = render(Toolbar, { props: { ...base, voiceURI: 'kyoko' } })
    expect((present.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement).value).toBe('kyoko')
    cleanup()
    const absent = render(Toolbar, { props: { ...base, voiceURI: 'gone-machine-uri' } })
    expect((absent.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement).value).toBe('')
  })
  it('appears when voiceschanged later delivers Japanese voices', async () => {
    let voices: Array<Partial<SpeechSynthesisVoice>> = []
    const synth = fakeSynth([])
    synth.getVoices = () => voices as SpeechSynthesisVoice[]
    vi.stubGlobal('speechSynthesis', synth)
    render(Toolbar, { props: { ...base, voiceURI: null } })
    expect(screen.queryByRole('combobox', { name: 'voice' })).toBeNull()
    voices = [{ lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }]
    const listener = synth.addEventListener.mock.calls.find((c) => c[0] === 'voiceschanged')?.[1] as () => void
    listener()
    await tick()
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeInTheDocument()
  })
  it('maps the auto option to null on change', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }]))
    const user = userEvent.setup()
    render(Toolbar, { props: { ...base, voiceURI: 'kyoko' } })
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    await user.selectOptions(select, '')
    expect(select.value).toBe('')
  })
})

describe('Toolbar localization', () => {
  afterEach(() => setStoredLocale('en'))

  it('localizes the toolbar chrome', () => {
    setStoredLocale('de')
    render(Toolbar, { props: { ...base } })
    expect(screen.getByText(/Furigana/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Baum$/ })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Sprechtempo' })).toBeInTheDocument()
  })
})

describe('Toolbar view buttons', () => {
  it('offers three view buttons and reports the cabocha state', async () => {
    const user = userEvent.setup()
    render(Toolbar, { props: { ...base, view: 'cabocha' as const } })
    const cabocha = screen.getByRole('button', { name: /CaboCha/ })
    expect(cabocha).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /arcs/ })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: /arcs/ }))
    expect(screen.getByRole('button', { name: /arcs/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
