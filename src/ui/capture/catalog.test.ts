import { describe, expect, it } from 'vitest'
import type { Room } from '../../domain/furniture/references'
import { ANY, matches, noMatchNote, roomChips, sizeLine } from './catalog'

const item = (code: string, name: string, ...rooms: Room[]) => ({ code, name, rooms })

const items = [item('KC-LIB-03', 'Librero de nichos', 'living', 'office'), item('KC-BUR-05', 'Buró con cajón', 'bedroom'), item('GN-ESC-01', 'Escritorio de pie', 'office')]

const codes = (q: Partial<typeof ANY>) => items.filter((i) => matches(i, { ...ANY, ...q })).map((i) => i.code)

describe('matches', () => {
  it('finds a piece in every room it goes in', () => {
    expect(codes({ room: 'office' })).toEqual(['KC-LIB-03', 'GN-ESC-01'])
    expect(codes({ room: 'living' })).toEqual(['KC-LIB-03'])
    expect(codes({ room: 'kitchen' })).toEqual([])
  })
  it('finds by words of the name without minding accents or case, and by the code in any form', () => {
    expect(codes({ text: 'BURO cajon' })).toEqual(['KC-BUR-05'])
    for (const text of ['KC-LIB-03', 'lib03', '  kc-lib-03 ']) expect(codes({ text })).toEqual(['KC-LIB-03'])
  })
  it('searches inside the room chosen, not across all of them', () => {
    expect(codes({ text: 'librero', room: 'bedroom' })).toEqual([])
  })
})

describe('roomChips', () => {
  it('lists only the rooms that have something, after «Todas»', () => {
    expect(roomChips(items, ANY).map((c) => [c.label, c.count])).toEqual([['Todas', 3], ['Recámara', 1], ['Sala', 1], ['Oficina', 2]])
  })
  it('counts what the words typed would leave in each room, whichever room is chosen', () => {
    expect(roomChips(items, { room: 'bedroom', text: 'escritorio' }).map((c) => c.count)).toEqual([1, 0, 0, 1])
  })
})

describe('sizeLine', () => {
  it('says width, depth and height in cm, with a decimal only when there is one', () => {
    expect(sizeLine({ height: 700, width: 1956, depth: 1370 })).toEqual({ text: '195.6 × 137 × 70 cm', spoken: '195.6 de ancho, 137 de fondo, 70 de alto, en centímetros' })
  })
})

describe('noMatchNote', () => {
  it('says what was typed, and the room only when one is chosen', () => {
    expect(noMatchNote({ room: 'all', text: ' banca ' })).toBe('Ninguna base tiene «banca» en su nombre.')
    expect(noMatchNote({ room: 'office', text: 'banca' })).toBe('Ninguna base de ese cuarto tiene «banca» en su nombre.')
  })
})
