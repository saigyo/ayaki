// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Inspector from '../../src/components/Inspector.svelte'
import { sentenceFixture } from '../fixtures'

const sentence = sentenceFixture()

describe('Inspector — sentence mode', () => {
  it('offers speech, Google Translate and a confidence summary', () => {
    render(Inspector, { props: { fullText: sentence.text, sentences: [sentence], selected: null, rate: 1 } })
    expect(screen.getByText(sentence.text)).toBeInTheDocument()
    const gt = screen.getByRole('link', { name: /google translate/i })
    expect(gt).toHaveAttribute('href', expect.stringContaining('translate.google.com'))
    expect(gt).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(sentence.text)))
    // fixture has 1 uncertain of 2 non-root attachments
    expect(screen.getByText(/1 of 2 attachments uncertain/)).toBeInTheDocument()
    // jsdom has no speechSynthesis → speech buttons disabled with explanation
    const speakBtn = screen.getByRole('button', { name: /speak/i })
    expect(speakBtn).toBeDisabled()
    expect(speakBtn).toHaveAttribute('title', expect.stringMatching(/no japanese voice/i))
  })
  it('shows a hint before anything was parsed', () => {
    render(Inspector, { props: { fullText: '', sentences: [], selected: null, rate: 1 } })
    expect(screen.getByText(/click a part/i)).toBeInTheDocument()
  })
})

describe('Inspector — bunsetsu mode', () => {
  it('renders one card per morpheme with reading, POS pair, base form and Jisho link', () => {
    render(Inspector, { props: { fullText: sentence.text, sentences: [sentence], selected: sentence.bunsetsu[2], rate: 1 } })
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
})
