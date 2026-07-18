import { describe, expect, it } from 'vitest'
import { loadParser } from 'sasara'

describe('toolchain smoke', () => {
  it('resolves sasara', () => {
    expect(typeof loadParser).toBe('function')
  })
})
