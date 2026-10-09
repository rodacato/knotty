import { describe, expect, it } from 'vitest'
import { browsingFrom, searchWith } from './address'
import { ANY } from './catalog'

describe("the home's filter in the address", () => {
  it('goes into the address and comes back the same', () => {
    const search = searchWith('', { text: 'escritorio de pie', room: 'office' })
    expect(search).toBe('?q=escritorio+de+pie&cuarto=oficina')
    expect(browsingFrom(search)).toEqual({ text: 'escritorio de pie', room: 'office' })
  })

  it('names the room as the person reads it, with or without its accent', () => {
    expect(searchWith('', { text: '', room: 'bedroom' })).toBe('?cuarto=recamara')
    expect(browsingFrom('?cuarto=Recámara').room).toBe('bedroom')
  })

  it('is no filter for an address that says none, or a room Knotty does not have', () => {
    expect(browsingFrom('')).toEqual(ANY)
    expect(browsingFrom('?cuarto=sotano&ficha=KC-MES-03')).toEqual(ANY)
  })

  it('leaves the rest of the address alone, and takes itself out when the filter is cleared', () => {
    expect(searchWith('?ficha=KC-MES-03', { text: 'mesa', room: 'all' })).toBe('?ficha=KC-MES-03&q=mesa')
    expect(searchWith('?ficha=KC-MES-03&q=mesa&cuarto=sala', ANY)).toBe('?ficha=KC-MES-03')
    expect(searchWith('?q=mesa', ANY)).toBe('')
  })
})
