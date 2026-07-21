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
    // the pills carry the raw surfaces; labels/ruby are aria-hidden annotations
    const parts = [...screen.getByRole('heading').querySelectorAll('.part')].map((p) => p.textContent)
    expect(parts).toEqual(['食べ', '。'])
    expect(screen.getAllByText('食べ')).toHaveLength(2)
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
    const bunsetsu: BunsetsuVM = { index: 0, surface: '！！', head: null, probability: null, forced: false, reading: '', morphemes: [dup, { ...dup }], relation: null }
    render(Inspector, { props: { sentence: null, index: 0, total: 1, selected: bunsetsu, rate: 1, voiceURI: null } })
    expect(screen.getAllByText('！')).toHaveLength(4)
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

describe('relation line', () => {
  it('shows term, head surface, explanation, and UD link', () => {
    // render with the fixture's non-root bunsetsu selected (e.g. 魚を → 食べた。)
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null } })
    const line = document.querySelector('.inspector .relation-line')!
    expect(line.textContent).toContain('object')
    expect(line.textContent).toContain('→ 食べた。')
    expect(line.textContent).toContain('what the action directly acts on (を)')
    const link = line.querySelector('a')!
    expect(link.getAttribute('href')).toBe('https://universaldependencies.org/u/dep/obj.html')
    expect(link.getAttribute('target')).toBe('_blank')
  })
  it('root shows predicate without an arrow', () => {
    // select the root bunsetsu
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: null } })
    const line = document.querySelector('.inspector .relation-line')!
    expect(line.textContent).toContain('predicate')
    expect(line.textContent).not.toContain('→')
    expect(line.querySelector('a')!.getAttribute('href')).toBe('https://universaldependencies.org/u/dep/root.html')
  })
})

describe('segmented parts', () => {
  it('links segments to entries bidirectionally and scrolls on segment hover', async () => {
    const scrollSpy = vi.fn()
    // jsdom has no scrollIntoView, so vi.spyOn cannot attach — stub and restore manually
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollSpy
    try {
      const s = sentenceFixture()
      const { container } = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[2], rate: 1, voiceURI: null } })
      const parts = container.querySelectorAll('.part')
      const entries = container.querySelectorAll('.morpheme')
      expect(parts.length).toBe(entries.length)
      await fireEvent.mouseEnter(container.querySelectorAll('.part-col')[1])
      expect(entries[1]).toHaveClass('active')
      expect(parts[1]).toHaveClass('active')
      expect(scrollSpy).toHaveBeenCalled()
      await fireEvent.mouseEnter(entries[0])
      expect(parts[0]).toHaveClass('active')
      expect(entries[1]).not.toHaveClass('active')
      await fireEvent.mouseLeave(entries[0])
      expect(parts[0]).not.toHaveClass('active')
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
  it('keeps the segment highlight while focus moves within the same entry', async () => {
    const s = sentenceFixture()
    const { container } = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[0], rate: 1, voiceURI: null } })
    const entries = container.querySelectorAll('.morpheme')
    const parts = container.querySelectorAll('.part')
    const controls = entries[0].querySelectorAll('button, a')
    await fireEvent.focusIn(entries[0])
    expect(parts[0]).toHaveClass('active')
    await fireEvent.focusOut(entries[0], { relatedTarget: controls[controls.length - 1] })
    expect(parts[0]).toHaveClass('active')
    await fireEvent.focusOut(entries[0], { relatedTarget: document.body })
    expect(parts[0]).not.toHaveClass('active')
  })
  it('shows ruby in the heading when furigana is on', () => {
    const s = sentenceFixture()
    const { container } = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[0], rate: 1, voiceURI: null, showFurigana: true } })
    const rubies = [...container.querySelectorAll('.part-ruby')].map((r) => r.textContent)
    expect(rubies).toEqual(['ねこ', ''])
    const off = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[0], rate: 1, voiceURI: null } })
    expect(off.container.querySelectorAll('.part-ruby')).toHaveLength(0)
  })
  it('renders quiet parts and entries when quietParts is on', () => {
    const s = sentenceFixture()
    const { container } = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[0], rate: 1, voiceURI: null, quietParts: true } })
    expect(container.querySelector('.part')).toHaveClass('quiet')
    expect(container.querySelector('.morpheme')).toHaveClass('quiet')
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

  it('resets the copied label when the share url changes without a card switch', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const { rerender } = render(Inspector, { props: { sentence, index: 0, total: 2, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    await vi.waitFor(() => expect(screen.getByText('copied!')).toBeInTheDocument())
    // switch to another sentence: still sentence mode (selected stays null), url differs
    await rerender({ sentence, index: 1, total: 2, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a&s=1' })
    expect(screen.queryByText('copied!')).toBeNull()
  })

  it('ignores a copy that resolves only after the card switched', async () => {
    let resolveWrite: () => void
    const writeText = vi.fn(() => new Promise<void>((r) => (resolveWrite = r)))
    setClipboard({ writeText })
    const { rerender } = render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    await rerender({ sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a&b=1' })
    resolveWrite!()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(screen.queryByText('copied!')).toBeNull()
  })

  it('resets the copied label when the card switches', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const { rerender } = render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    await vi.waitFor(() => expect(screen.getByText('copied!')).toBeInTheDocument())
    await rerender({ sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a&b=1' })
    expect(screen.queryByText('copied!')).toBeNull()
    expect(screen.getByRole('button', { name: 'share link' })).toBeInTheDocument()
  })
})
