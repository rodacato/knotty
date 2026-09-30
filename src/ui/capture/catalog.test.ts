import { describe, expect, it } from 'vitest'
import type { Base } from '../../domain/furniture/examples'
import { basesOfFilter, countLine, onlyOneNote } from './catalog'

const base = (id: string, category: Base['category']) => ({ id, category }) as Base

const bases = [base('a', 'storage'), base('b', 'bedroom'), base('c', 'storage'), base('d', 'tables')]

describe('basesOfFilter', () => {
  it('keeps every base in its order for featured', () => {
    expect(basesOfFilter(bases, 'featured').map((b) => b.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('lists all the bases of a category, in order', () => {
    expect(basesOfFilter(bases, 'storage').map((b) => b.id)).toEqual(['a', 'c'])
  })
  it('gives nothing for a category without bases', () => {
    expect(basesOfFilter([base('a', 'storage')], 'tables')).toEqual([])
  })
})

describe('countLine', () => {
  it('counts featured and agrees in number', () => {
    expect(countLine(9, 'featured')).toBe('9 destacados · alto × ancho × fondo, en mm')
    expect(countLine(1, 'featured')).toBe('1 destacado · alto × ancho × fondo, en mm')
  })
  it('names the category', () => {
    expect(countLine(1, 'tables')).toBe('1 mesa · alto × ancho × fondo, en mm')
    expect(countLine(3, 'storage')).toBe('3 muebles para guardar · alto × ancho × fondo, en mm')
  })
})

describe('onlyOneNote', () => {
  it('appears for a category with one base', () => {
    expect(onlyOneNote(1, 'tables')).toBe('Solo hay una base de mesas por ahora.')
  })
  it('does not appear for featured or for several', () => {
    expect(onlyOneNote(1, 'featured')).toBeNull()
    expect(onlyOneNote(2, 'tables')).toBeNull()
  })
})
