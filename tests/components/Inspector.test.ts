// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Inspector from '../../src/components/Inspector.svelte'
import { forcedSentenceFixture, morphemeFixture, sentenceFixture } from '../fixtures'
import type { BunsetsuVM } from '../../src/lib/types'
import { setStoredLocale } from '../../src/lib/i18n.svelte'

const sentence = sentenceFixture()

describe('Inspector — sentence mode', () => {
  it('shows only the active sentence with speech, Translate and a confidence summary', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, showConfidence: true } })
    expect(screen.getByRole('heading', { name: 'Sentence' })).toBeInTheDocument()
    expect(screen.getByText(sentence.text)).toBeInTheDocument()
    const gt = screen.getByRole('link', { name: /google translate/i })
    expect(gt).toHaveAttribute('href', expect.stringContaining('translate.google.com'))
    expect(gt).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(sentence.text)))
    // fixture has 1 uncertain of 2 non-root attachments; no "Sentence N:" prefix
    expect(screen.getByText('1 of 2 attachments uncertain')).toBeInTheDocument()
    // jsdom has no speechSynthesis → speech buttons disabled with explanation
    const speakBtn = screen.getByRole('button', { name: /speak/i })
    expect(speakBtn).toBeDisabled()
    expect(speakBtn).toHaveAttribute('title', expect.stringMatching(/no japanese voice/i))
  })
  it('numbers the heading when there are multiple sentences', () => {
    render(Inspector, { props: { sentence, index: 1, total: 3, selected: null, rate: 1, voiceURI: null } })
    expect(screen.getByRole('heading', { name: 'Sentence 2 / 3' })).toBeInTheDocument()
  })
  it('shows a hint before anything was parsed', () => {
    render(Inspector, { props: { sentence: null, index: 0, total: 0, selected: null, rate: 1, voiceURI: null } })
    expect(screen.getByText(/click a part/i)).toBeInTheDocument()
  })
})

describe('Inspector — bunsetsu mode', () => {
  it('renders one card per morpheme with reading, POS pair, base form and Jisho link', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: null } })
    expect(screen.getByRole('heading', { name: /食べた。/ })).toBeInTheDocument()
    expect(screen.getByText('食べ')).toBeInTheDocument()
    expect(screen.getByText('（たべ）')).toBeInTheDocument()
    expect(screen.getByText('動詞・自立')).toBeInTheDocument()
    expect(screen.getByText('verb (independent)')).toBeInTheDocument()
    expect(screen.getByText('食べる')).toBeInTheDocument()
    expect(screen.getByText('連用形')).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /jisho/i })
    expect(links).toHaveLength(1) // 。 gets none
    expect(links[0]).toHaveAttribute('href', 'https://jisho.org/search/%E9%A3%9F%E3%81%B9%E3%82%8B')
  })
  it('shows the attachment confidence line for probability and for forced-only attachments', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null, showConfidence: true } })
    expect(screen.getByText(/P = 55%/)).toBeInTheDocument()
    const forced = forcedSentenceFixture()
    render(Inspector, { props: { sentence: forced, index: 0, total: 1, selected: forced.bunsetsu[0], rate: 1, voiceURI: null, showConfidence: true } })
    expect(screen.getByText(/forced attachment \(end-of-sentence fallback\)/)).toBeInTheDocument()
  })
  it('hides the confidence labels unless enabled', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null } })
    expect(screen.queryByText(/attachments uncertain/)).toBeNull()
    const bunsetsuView = render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null } })
    expect(bunsetsuView.queryByText(/P = 55%/)).toBeNull()
  })
  it('renders bunsetsu with duplicate identical morphemes without crashing', () => {
    const dup = morphemeFixture({ surface: '！', reading: null, posJa: '記号・一般', jishoUrl: null })
    const bunsetsu: BunsetsuVM = { index: 0, surface: '！！', head: null, probability: null, forced: false, reading: '', morphemes: [dup, { ...dup }] }
    render(Inspector, { props: { sentence: null, index: 0, total: 1, selected: bunsetsu, rate: 1, voiceURI: null } })
    expect(screen.getAllByText('！')).toHaveLength(2)
  })
  afterEach(() => setStoredLocale('en'))

  it('renders localized chrome in ZH and hides glosses in JA', () => {
    setStoredLocale('zh')
    const zhView = render(Inspector, { props: { sentence, index: 0, total: 2, selected: null, rate: 1, voiceURI: null } })
    expect(zhView.getByRole('heading', { name: '句子 1 / 2' })).toBeInTheDocument()
    setStoredLocale('ja')
    const jaView = render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: null } })
    expect(jaView.queryByText('verb (independent)')).toBeNull()
    expect(jaView.getByText('動詞・自立')).toBeInTheDocument()
  })
  it('uses the speaking-head glyph on speak buttons', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: null } })
    expect(screen.getByRole('button', { name: 'speak bunsetsu' }).textContent).toContain('🗣️')
  })
  it('offers no speak button on punctuation morphemes', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: null } })
    expect(screen.getByRole('button', { name: 'speak 食べ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'speak 。' })).toBeNull()
  })
})

describe('Inspector — share button', () => {
  const setClipboard = (value: unknown) =>
    Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
  afterEach(() => {
    setClipboard(undefined)
    vi.useRealTimers()
  })

  it('copies the share url and flips the label for two seconds', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    expect(writeText).toHaveBeenCalledWith('https://x/?text=a')
    await vi.waitFor(() => expect(screen.getByText('copied!')).toBeInTheDocument())
    await vi.advanceTimersByTimeAsync(2100)
    expect(screen.queryByText('copied!')).toBeNull()
    expect(screen.getByRole('button', { name: 'share link' })).toBeInTheDocument()
  })

  it('falls back to window.prompt without a clipboard', async () => {
    setClipboard(undefined)
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledWith('share link', 'https://x/?text=a'))
    prompt.mockRestore()
  })

  it('resets a stale copied label when a later copy fails', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'))
    setClipboard({ writeText })
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    await vi.waitFor(() => expect(screen.getByText('copied!')).toBeInTheDocument())
    await fireEvent.click(screen.getByText('copied!'))
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledWith('share link', 'https://x/?text=a'))
    expect(screen.queryByText('copied!')).toBeNull()
    prompt.mockRestore()
  })

  it('offers the share button on the bunsetsu card too', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a&b=1' } })
    expect(screen.getByRole('button', { name: 'share link' })).toBeInTheDocument()
  })
})
