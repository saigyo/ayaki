// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
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

  it('maps a code selection to the matching bindable locale', async () => {
    setStoredLocale('en')
    const user = userEvent.setup()
    render(LocaleSwitcher, { props: { locale: 'de' } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    await user.selectOptions(select, 'ja')
    await tick()
    // if the onchange handler mapped the selection wrong (e.g. always to null),
    // the reactive `selected={l === locale}` bindings would revert the DOM
    // selection back to Auto on re-render -- this proves the bindable is 'ja'.
    const options = [...select.options]
    const jaIndex = options.findIndex((o) => o.value === 'ja')
    expect(options[jaIndex].selected).toBe(true)
    expect(select.selectedIndex).toBe(jaIndex)
  })

  it('maps the auto option to a null bindable on change', async () => {
    setStoredLocale('en')
    const user = userEvent.setup()
    render(LocaleSwitcher, { props: { locale: 'de' } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    await user.selectOptions(select, '')
    await tick()
    expect(select.selectedIndex).toBe(0)
    expect(select.options[0].selected).toBe(true)
  })

  it('maps an out-of-catalog value to a null bindable on change', async () => {
    setStoredLocale('en')
    render(LocaleSwitcher, { props: { locale: 'de' } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    // no option for 'xx' exists in the component's markup, so add one
    // directly to genuinely drive the handler with an out-of-catalog value.
    select.add(new Option('unsupported', 'xx'))
    select.value = 'xx'
    await fireEvent.change(select)
    await tick()
    // a correct handler maps the unknown value to null, which re-selects
    // Auto and deselects our injected option (single-select semantics).
    expect(select.selectedIndex).toBe(0)
    expect(select.options[0].selected).toBe(true)
  })
})
