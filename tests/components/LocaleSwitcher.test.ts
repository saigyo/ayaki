// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import LocaleSwitcher from '../../src/components/LocaleSwitcher.svelte'
import { setStoredLocale } from '../../src/lib/i18n.svelte'

describe('LocaleSwitcher', () => {
  afterEach(() => setStoredLocale('en'))

  it('renders a decorative globe and an accessibly named select', () => {
    setStoredLocale('en')
    const { container } = render(LocaleSwitcher, { props: { locale: null } })
    const globe = container.querySelector('.locale-switcher [aria-hidden="true"]')
    expect(globe?.textContent).toBe('🌐')
    expect(screen.getByRole('combobox', { name: 'language' })).toBeInTheDocument()
  })

  it('lists auto plus the four languages named in themselves', () => {
    setStoredLocale('en')
    render(LocaleSwitcher, { props: { locale: null } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Auto (browser)', 'English', 'Deutsch', '日本語', '中文',
    ])
    expect(select.value).toBe('')
  })

  it('shows the stored locale selected', () => {
    setStoredLocale('en')
    render(LocaleSwitcher, { props: { locale: 'ja' } })
    expect((screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement).value).toBe('ja')
  })

  it('maps codes to codes and auto to null on change', async () => {
    setStoredLocale('en')
    const user = userEvent.setup()
    render(LocaleSwitcher, { props: { locale: 'de' } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    expect(select.value).toBe('de')
    await user.selectOptions(select, '')
    expect(select.value).toBe('')
  })
})
