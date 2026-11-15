import { describe, expect, it } from 'vitest'
import catalogData from '../../../public/catalog/catalog.json'
import { createBundledReferences } from '../../adapters/references/store'
import { Catalog } from '../../domain/materials/catalog'
import { cardsOf } from './cards'
import { packPlates, shapeOf, type Plate, type Shape } from './plates'
import { sketch } from './sketch'

const cells = (p: Plate) => Array.from({ length: p.rows * p.columns }, (_, i) => `${p.row + Math.floor(i / p.columns)},${p.column + (i % p.columns)}`)

function expectSound(shapes: Shape[], columns: number) {
  const plates = packPlates(shapes, columns)
  expect(plates.map((p) => p.index).sort((a, b) => a - b)).toEqual(shapes.map((_, i) => i))
  const all = plates.flatMap(cells)
  expect(new Set(all).size).toBe(all.length)
  for (const p of plates) expect(p.column + p.columns).toBeLessThanOrEqual(columns)
  expect(plates.map((p) => p.number)).toEqual(plates.map((_, i) => i + 1))
  for (let i = 1; i < plates.length; i++) {
    const [a, b] = [plates[i - 1], plates[i]]
    expect(a.row < b.row || (a.row === b.row && a.column < b.column)).toBe(true)
  }
  return plates
}

describe('the catalog plates', () => {
  it('give a wide piece two columns and a tall one two rows, as the north star spreads them', () => {
    const plates = expectSound(['wide', 'wide', 'tall'], 3)
    expect(plates.map(({ index, row, column, columns, rows }) => ({ index, row, column, columns, rows }))).toEqual([
      { index: 0, row: 0, column: 0, columns: 2, rows: 1 },
      { index: 2, row: 0, column: 2, columns: 1, rows: 2 },
      { index: 1, row: 1, column: 0, columns: 2, rows: 1 },
    ])
  })

  it('fill a hole a wide plate left with a later small one', () => {
    const plates = expectSound(['square', 'square', 'wide', 'square'], 3)
    expect(plates.find((p) => p.index === 2)).toMatchObject({ row: 1, column: 0 })
    expect(plates.find((p) => p.index === 3)).toMatchObject({ row: 0, column: 2, number: 3 })
  })

  it('stack one plate per row on a phone', () => {
    const plates = expectSound(['wide', 'tall', 'square'], 1)
    expect(plates.every((p) => p.columns === 1 && p.rows === 1)).toBe(true)
  })

  it('place the whole catalog soundly at every width', () => {
    const cards = cardsOf(createBundledReferences().home(), Catalog.parse(catalogData))
    const shapes = cards.map((c) => (c.boxes ? (({ width, height }) => shapeOf(width, height))(sketch(c.boxes)) : 'square'))
    expect(new Set(shapes)).toEqual(new Set(['wide', 'tall', 'square']))
    for (const columns of [1, 2, 3]) expectSound(shapes, columns)
  })
})
