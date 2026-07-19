// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import App from '../../src/components/App.svelte'
import { setStoredLocale } from '../../src/lib/i18n.svelte'
import { forcedSentenceFixture, sentenceFixture } from '../fixtures'

vi.mock('../../src/lib/parser', () => ({
  parseText: vi.fn(),
  parserReady: vi.fn(() => false),
}))
import { parseText } from '../../src/lib/parser'

beforeEach(() => {
  vi.mocked(parseText).mockReset()
  localStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('parses input and shows the tree, then inspects a clicked bunsetsu', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox', { name: /japanese text/i }), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    const box = await screen.findByText('魚を')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Inspector switches to bunsetsu mode
    expect(await screen.findByRole('heading', { name: /魚を/ })).toBeInTheDocument()
    expect(screen.getByText('（さかな）')).toBeInTheDocument()
  })
  it('parses the built-in example from the idle hint', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.click(screen.getByRole('button', { name: /try the example/i }))
    expect(await screen.findByText('食べた。')).toBeInTheDocument()
    expect(parseText).toHaveBeenCalledWith('昨日、私は友達と新しい映画を見に行きました。')
  })
  it('shows an error banner with retry when init fails', async () => {
    vi.mocked(parseText).mockRejectedValueOnce(new Error('model.json missing')).mockResolvedValueOnce([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), '猫。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    expect(await screen.findByText(/model\.json missing/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('食べた。')).toBeInTheDocument()
  })
  it('renders a per-sentence error inline', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), { text: '壊れた文', bunsetsu: [], error: 'boom' }])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), 'x')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    expect(await screen.findByText(/boom/)).toBeInTheDocument()
    expect(screen.getByText('食べた。')).toBeInTheDocument()
  })
  it('shows the attribution footer', () => {
    render(App)
    expect(screen.getByText(/CC BY-SA 4\.0/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sasara/i })).toBeInTheDocument()
  })
  it('scopes the inspector to the active sentence and switches on card click', async () => {
    // two sentences: 猫が魚を食べた。 and これは何。
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), forcedSentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。これは何。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    // default: first sentence active, its full text in the inspector
    expect(await screen.findByText('猫が魚を食べた。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sentence 1 / 2' })).toBeInTheDocument()
    expect(screen.queryByText('これは何。')).not.toBeInTheDocument()
    const cards = container.querySelectorAll('.card')
    expect(cards[0].classList.contains('active')).toBe(true)
    // clicking the second card's empty space switches the active sentence
    cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByText('これは何。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sentence 2 / 2' })).toBeInTheDocument()
    expect(screen.queryByText('猫が魚を食べた。')).not.toBeInTheDocument()
    expect(cards[1].classList.contains('active')).toBe(true)
    expect(cards[0].classList.contains('active')).toBe(false)
  })
  it('activates a sentence when one of its bunsetsu is selected', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), forcedSentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), 'x')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    const box = await screen.findByText('これは')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // bunsetsu mode for the clicked bunsetsu of sentence 2
    expect(await screen.findByRole('heading', { name: /これは/ })).toBeInTheDocument()
    // Escape returns to the sentence view of the now-active second sentence
    await user.keyboard('{Escape}')
    expect(await screen.findByText('これは何。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sentence 2 / 2' })).toBeInTheDocument()
  })
  it('deselects the bunsetsu on empty-space click, also with a single sentence', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    const box = await screen.findByText('魚を')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByRole('heading', { name: /魚を/ })).toBeInTheDocument()
    const card = container.querySelector('.card')!
    // single sentence → no active border
    expect(card.classList.contains('active')).toBe(false)
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByRole('heading', { name: 'Sentence' })).toBeInTheDocument()
    expect(screen.getByText('猫が魚を食べた。')).toBeInTheDocument()
  })
  it('resets the active sentence on re-parse', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), forcedSentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), 'x')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    await screen.findByText('これは')
    const cards = container.querySelectorAll('.card')
    cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByRole('heading', { name: 'Sentence 2 / 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /parse/i }))
    expect(await screen.findByRole('heading', { name: 'Sentence 1 / 2' })).toBeInTheDocument()
  })
  it('restores settings from localStorage and persists changes', async () => {
    localStorage.setItem('ayaki-settings', JSON.stringify({ showFurigana: true, view: 'tree', rate: 1.2 }))
    const user = userEvent.setup()
    render(App)
    const furigana = screen.getByRole('checkbox', { name: /furigana/i })
    expect(furigana).toBeChecked()
    expect(screen.getByRole('button', { name: /tree/ })).toHaveAttribute('aria-pressed', 'true')
    expect((screen.getByRole('slider', { name: /speech rate/i }) as HTMLInputElement).value).toBe('1.2')
    await user.click(furigana)
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!)).toEqual({
      showFurigana: false,
      view: 'tree',
      rate: 1.2,
      voiceURI: null,
      locale: null,
    })
  })
  it('binds the voice selector to the persisted setting', async () => {
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
      ] as SpeechSynthesisVoice[],
      cancel: vi.fn(),
      speak: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    localStorage.setItem('ayaki-settings', JSON.stringify({ voiceURI: 'cloud' }))
    const user = userEvent.setup()
    render(App)
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    expect(select.value).toBe('cloud')
    await user.selectOptions(select, 'kyoko')
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).voiceURI).toBe('kyoko')
  })
  it('renders a stored locale on first paint, before effects run', () => {
    localStorage.setItem('ayaki-settings', JSON.stringify({ locale: 'de' }))
    render(App)
    // synchronous assertion: effects have not flushed yet, so this only passes
    // if the stored locale is applied during component init, not in the $effect
    expect(screen.getByRole('button', { name: 'Analysieren' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('de')
    setStoredLocale(null)
  })
  it('switches chrome and glosses when the locale changes, without re-parsing', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    const box = await screen.findByText('食べた。')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByText('verb (independent)')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'language' }), 'de')
    expect(await screen.findByText('Verb (selbstständig)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analysieren/ })).toBeInTheDocument()
    expect(parseText).toHaveBeenCalledTimes(1)
    // and the locale choice is persisted
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).locale).toBe('de')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sprache' }), '')
    expect(await screen.findByRole('button', { name: /parse/i })).toBeInTheDocument()
  })
  it('places the locale switcher in the header brand, not the toolbar', () => {
    render(App)
    const select = screen.getByRole('combobox', { name: 'language' })
    expect(select.closest('.brand')).not.toBeNull()
    expect(select.closest('.toolbar')).toBeNull()
  })
  it('switches to the cabocha view and persists the choice', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    await screen.findByText('食べた。')
    await user.click(screen.getByRole('button', { name: /CaboCha/ }))
    expect(container.querySelector('svg.stairview')).not.toBeNull()
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).view).toBe('cabocha')
  })
})
