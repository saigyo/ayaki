// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Inspector from '../../src/components/Inspector.svelte'
import { sentenceFixture } from '../fixtures'

vi.mock('../../src/lib/speech', () => ({
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  speechAvailable: () => true,
}))
import { speak, stopSpeech } from '../../src/lib/speech'

const sentence = sentenceFixture()

beforeEach(vi.clearAllMocks)

describe('Inspector speak pass-through', () => {
  it('passes the selected voice when speaking the sentence', async () => {
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 0.9, voiceURI: 'kyoko' } })
    await user.click(screen.getByRole('button', { name: /speak/i }))
    expect(speak).toHaveBeenCalledWith(sentence.text, 0.9, 'kyoko', expect.any(Function))
  })
  it('passes the selected voice for bunsetsu and morpheme buttons', async () => {
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: 'cloud' } })
    await user.click(screen.getByRole('button', { name: 'speak bunsetsu' }))
    expect(speak).toHaveBeenCalledWith('食べた。', 1, 'cloud')
    await user.click(screen.getByRole('button', { name: 'speak 食べ' }))
    expect(speak).toHaveBeenCalledWith('食べ', 1, 'cloud')
  })
  it('toggles into Stop while speaking and back when the utterance ends', async () => {
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null } })
    const btn = screen.getByRole('button', { name: /speak/i })
    await user.click(btn)
    expect(btn.textContent).toContain('Stop')
    expect(screen.queryByRole('button', { name: /^speak$/i })).toBeNull()
    const onDone = vi.mocked(speak).mock.calls.at(-1)![3] as () => void
    onDone()
    await tick()
    expect(btn.textContent).toContain('Speak')
  })

  it('stops the speech when clicked while speaking', async () => {
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null } })
    const btn = screen.getByRole('button', { name: /speak/i })
    await user.click(btn)
    await user.click(btn)
    expect(stopSpeech).toHaveBeenCalledOnce()
    expect(btn.textContent).toContain('Speak')
    expect(vi.mocked(speak)).toHaveBeenCalledOnce()
  })
})
