// @vitest-environment jsdom
import { render, screen, fireEvent, within } from '@testing-library/svelte'
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
    const note = screen.getByText(/no japanese voice/i)
    expect(note).toBeInTheDocument()
    expect(select.getAttribute('aria-describedby')).toBe(note.id)
  })

  it('renders the threshold slider bounded 60-90% and updates the readout', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, showConfidence: true, confidenceThreshold: 0.7 } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const slider = screen.getByRole('slider', { name: 'uncertainty cutoff' }) as HTMLInputElement
    expect(slider.min).toBe('0.6')
    expect(slider.max).toBe('0.9')
    expect(slider.step).toBe('0.05')
    expect(slider.disabled).toBe(false)
    expect(screen.getByText('70%')).toBeInTheDocument()
    await fireEvent.input(slider, { target: { value: '0.85' } })
    expect(screen.getByText('85%')).toBeInTheDocument()
  })
  it('disables the threshold slider while confidence display is off', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, showConfidence: false } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const slider = screen.getByRole('slider', { name: 'uncertainty cutoff' }) as HTMLInputElement
    expect(slider.disabled).toBe(true)
    expect(slider).toHaveAttribute('title', 'show attachment confidence')
  })

  it('renders the quiet-parts checkbox unchecked by default', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    expect(screen.getByRole('checkbox', { name: 'quiet part colors' })).not.toBeChecked()
  })

  it('binds the relation-display and arrow-direction selects', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const rel = screen.getByRole('combobox', { name: 'relation labels' }) as HTMLSelectElement
    expect(rel.value).toBe('arrows')
    await user.selectOptions(rel, 'badges')
    expect(rel.value).toBe('badges')
    const dir = screen.getByRole('combobox', { name: 'arrow direction' }) as HTMLSelectElement
    expect(dir.value).toBe('ud')
    await user.selectOptions(dir, 'kakariuke')
    expect(dir.value).toBe('kakariuke')
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

  it('closes on outside click even when the target stops propagation (bunsetsu boxes)', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    const gear = screen.getByRole('button', { name: 'settings' })
    await user.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'true')
    const sibling = document.createElement('button')
    sibling.textContent = 'bunsetsu'
    sibling.addEventListener('click', (e) => e.stopPropagation())
    document.body.appendChild(sibling)
    try {
      await user.click(sibling)
      expect(gear).toHaveAttribute('aria-expanded', 'false')
    } finally {
      sibling.remove()
    }
  })

  it('offers the confidence toggle, enabled even without voices', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, showConfidence: false } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const box = screen.getByRole('checkbox', { name: 'show attachment confidence' })
    expect(box).toBeEnabled()
    expect(box).not.toBeChecked()
    await user.click(box)
    expect(box).toBeChecked()
  })

  it('offers the chain swatch radio group and round-trips it', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const group = screen.getByRole('group', { name: 'chain to predicate' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['amber', 'green', 'violet', 'none'])
    expect(screen.getByRole('radio', { name: 'amber' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'green' }))
    expect(screen.getByRole('radio', { name: 'green' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'amber' })).not.toBeChecked()
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
