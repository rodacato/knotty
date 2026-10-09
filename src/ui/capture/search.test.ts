import { describe, expect, it } from 'vitest'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { found, notFoundNote, roomsLine } from './catalog'

const bases = testReferences.home()
const codes = (text: string) => bases.filter((b) => found(b, text)).map((b) => b.code)
const sideboard = bases.find((b) => b.code === 'KC-APA-01')!

describe('searching the furniture in the spotlight', () => {
  it('finds by the room a piece goes in, without minding accents or case', () => {
    const bedroom = bases.filter((b) => b.rooms.includes('bedroom')).map((b) => b.code)
    expect(bedroom.length).toBeGreaterThan(0)
    expect(codes('recamara')).toEqual(expect.arrayContaining(bedroom))
    expect(codes('RECÁMARA')).toEqual(codes('recamara'))
    expect(codes('comedor')).toContain('KC-APA-01')
  })

  it('finds the exact model by its code in any form', () => {
    for (const text of ['KC-LIB-03', 'kc-lib-03', 'lib03', '  LIB-03 ']) expect(codes(text)).toEqual(['KC-LIB-03'])
    expect(codes('KC-LIB-999')).toEqual([])
  })

  it('asks for every word, each in the name, a room or the model', () => {
    const both = codes(`${sideboard.name.split(' ')[0]} comedor`)
    expect(both).toContain('KC-APA-01')
    expect(both.every((code) => bases.find((b) => b.code === code)!.rooms.includes('dining'))).toBe(true)
    expect(codes('aparador xyz')).toEqual([])
    expect(codes('')).toHaveLength(bases.length)
  })

  it('names the rooms of a piece as the person reads them', () => {
    expect(roomsLine(sideboard)).toBe('Sala, Comedor')
    expect(notFoundNote(' xyz ')).toBe('Ningún mueble tiene «xyz» en su nombre, su cuarto o su modelo.')
  })
})
