// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import SettingsMenu from '../../src/components/SettingsMenu.svelte'

const base = { rate: 1, voiceURI: null }
const kyoko = { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }

function fakeSynth(voices: Array<Partial<SpeechSynthesisVoice>>) {
  return {
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('SettingsMenu', () => {
  it('renders a closed gear and opens the labeled popup on click', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    const gear = screen.getByRole('button', { name: 'settings' })
    expect(gear).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('combobox', { name: 'voice' })).toBeNull()
    await user.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'speech rate' })).toBeInTheDocument()
    expect(screen.getByText('1.0×')).toBeInTheDocument()
  })

  it('keeps the voice select semantics: auto first, stored-absent displays auto', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, voiceURI: 'gone-machine-uri' } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['auto', 'Kyoko'])
    expect(select.value).toBe('')
  })

  it('disables both controls and shows the note when no Japanese voices exist', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' }]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const select = screen.getByRole('combobox', { name: 'voice' })
    const slider = screen.getByRole('slider', { name: 'speech rate' })
    expect(select).toBeDisabled()
    expect(slider).toBeDisabled()
    expect(select).toHaveAttribute('title', expect.stringMatching(/no japanese voice/i))
    expect(slider).toHaveAttribute('title', expect.stringMatching(/no japanese voice/i))
    expect(screen.getByText(/no japanese voice/i)).toBeInTheDocument()
  })

  it('enables the controls live when voiceschanged delivers voices', async () => {
    let voices: Array<Partial<SpeechSynthesisVoice>> = []
    const synth = fakeSynth([])
    synth.getVoices = () => voices as SpeechSynthesisVoice[]
    vi.stubGlobal('speechSynthesis', synth)
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeDisabled()
    voices = [kyoko]
    const listener = synth.addEventListener.mock.calls.find((c) => c[0] === 'voiceschanged')?.[1] as () => void
    listener()
    await tick()
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeEnabled()
    expect(screen.queryByText(/no japanese voice/i)).toBeNull()
  })

  it('updates the readout when the slider moves', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    await fireEvent.input(screen.getByRole('slider', { name: 'speech rate' }), { target: { value: '1.3' } })
    expect(screen.getByText('1.3×')).toBeInTheDocument()
  })

  it('closes on outside click, toggles closed on gear click', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    const gear = screen.getByRole('button', { name: 'settings' })
    await user.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'true')
    await user.click(document.body)
    expect(gear).toHaveAttribute('aria-expanded', 'false')
    await user.click(gear)
    await user.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape closes the popup, stops propagation, and refocuses the gear', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      render(SettingsMenu, { props: { ...base } })
      const gear = screen.getByRole('button', { name: 'settings' })
      await user.click(gear)
      const select = screen.getByRole('combobox', { name: 'voice' })
      select.focus()
      await user.keyboard('{Escape}')
      expect(gear).toHaveAttribute('aria-expanded', 'false')
      expect(gear).toHaveFocus()
      expect(windowSpy).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })
})
