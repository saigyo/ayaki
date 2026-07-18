// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/components/App.svelte'
import { sentenceFixture } from '../fixtures'

vi.mock('../../src/lib/parser', () => ({
  parseText: vi.fn(),
  parserReady: vi.fn(() => false),
}))
import { parseText } from '../../src/lib/parser'

beforeEach(() => vi.mocked(parseText).mockReset())

describe('App', () => {
  it('parses input and shows the tree, then inspects a clicked bunsetsu', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox', { name: /japanese text/i }), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /解析/ }))
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
    await user.click(screen.getByRole('button', { name: /試してみる/ }))
    expect(await screen.findByText('食べた。')).toBeInTheDocument()
    expect(parseText).toHaveBeenCalledWith('昨日、私は友達と新しい映画を見に行きました。')
  })
  it('shows an error banner with retry when init fails', async () => {
    vi.mocked(parseText).mockRejectedValueOnce(new Error('model.json missing')).mockResolvedValueOnce([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), '猫。')
    await user.click(screen.getByRole('button', { name: /解析/ }))
    expect(await screen.findByText(/model\.json missing/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('食べた。')).toBeInTheDocument()
  })
  it('renders a per-sentence error inline', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), { text: '壊れた文', bunsetsu: [], error: 'boom' }])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), 'x')
    await user.click(screen.getByRole('button', { name: /解析/ }))
    expect(await screen.findByText(/boom/)).toBeInTheDocument()
    expect(screen.getByText('食べた。')).toBeInTheDocument()
  })
  it('shows the attribution footer', () => {
    render(App)
    expect(screen.getByText(/CC BY-SA 4\.0/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sasara/i })).toBeInTheDocument()
  })
})
