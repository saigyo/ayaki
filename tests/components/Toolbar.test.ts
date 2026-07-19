// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Toolbar from '../../src/components/Toolbar.svelte'
import { setStoredLocale } from '../../src/lib/i18n.svelte'

const base = { showFurigana: false, view: 'arcs' as const }

describe('Toolbar localization', () => {
  afterEach(() => setStoredLocale('en'))

  it('localizes the toolbar chrome', () => {
    setStoredLocale('de')
    render(Toolbar, { props: { ...base } })
    expect(screen.getByText(/Furigana/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Baum$/ })).toBeInTheDocument()
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
  it('renders the view buttons before the furigana checkbox', () => {
    render(Toolbar, { props: { ...base } })
    const toolbar = document.querySelector('.toolbar')!
    expect(toolbar.children[0].classList.contains('views')).toBe(true)
    expect(toolbar.children[1].querySelector('input[type="checkbox"]')).not.toBeNull()
  })
  it('reports every deliberate view click via onviewclick, including the current view', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(Toolbar, { props: { showFurigana: false, view: 'arcs', onviewclick: spy } })
    await user.click(screen.getByRole('button', { name: /arcs/ }))
    expect(spy).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: /tree/ }))
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
