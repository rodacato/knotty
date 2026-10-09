import { describe, expect, it } from 'vitest'
import { fichaLink, linkedFicha } from './link'

describe('the link to a ficha', () => {
  it('comes back as the same code, wherever the app is served from', () => {
    const link = fichaLink('KC-MES-03', { origin: 'https://example.test', pathname: '/knotty/' })
    expect(link).toBe('https://example.test/knotty/?ficha=KC-MES-03')
    expect(linkedFicha(new URL(link).search)).toEqual({ code: 'KC-MES-03', rest: '' })
  })

  it('reads the code in any case and keeps the rest of the address', () => {
    expect(linkedFicha('?debug&ficha=kc-mes-03')).toEqual({ code: 'KC-MES-03', rest: '?debug' })
  })

  it('asks for nothing when the address names no ficha', () => {
    expect(linkedFicha('')).toBeNull()
    expect(linkedFicha('?debug')).toBeNull()
    expect(linkedFicha('?ficha=')).toBeNull()
  })
})
