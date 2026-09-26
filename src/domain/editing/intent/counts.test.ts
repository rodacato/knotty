import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { exampleWallCabinet } from '../../furniture/fixtures/wallCabinet'
import { askedParts, describeMismatch, designParts, partsMismatch } from './counts'

describe('how many doors and drawers a description asks for', () => {
  it.each([
    ['Un aparador para el comedor de 1.60 de largo: abajo tres puertas y a la derecha dos cajones; arriba un cajoncito a la izquierda y tres nichos abiertos.', { doors: 3, drawers: 3 }],
    ['Alacena de pared con dos puertas y una repisa en medio, para platos', { doors: 2, drawers: null }],
    ['Buró con un cajón arriba y una repisa abierta abajo', { doors: null, drawers: 1 }],
    ['Librero de 5 repisas para libros, sin puertas, con zoclo al frente', { doors: 0, drawers: null }],
    ['Mueble bajo para TV con 2 puertas a los lados y un hueco abierto en medio', { doors: 2, drawers: null }],
    ['Una cajonera de cuatro cajones', { doors: null, drawers: 4 }],
  ])('%s', (text, parts) => expect(askedParts(text)).toEqual(parts))

  it('a count read two ways is not a count: that part is not checked', () => {
    expect(askedParts('Un aparador con puertas abajo y dos cajones').doors).toBeNull()
    expect(askedParts('En las tres primeras, puerta abajo y arriba un cajoncito').doors).toBeNull()
    expect(askedParts('Una cama con una base con cajones 3').drawers).toBeNull()
    expect(askedParts('Un clóset con dos puertas dobles').doors).toBeNull()
    expect(askedParts('Un ropero de dos puertas de dos hojas').doors).toBeNull()
    expect(askedParts('Cama con tres cajones de cada lado').drawers).toBeNull()
    expect(askedParts('Una cómoda sin cajones y dos cajones arriba').drawers).toBeNull()
  })

  it('«cajonera» is not a drawer, and a description without doors or drawers says nothing', () => {
    expect(askedParts('Una cajonera alta para el cuarto')).toEqual({ doors: null, drawers: null })
    expect(askedParts('Un librero con repisas para libros')).toEqual({ doors: null, drawers: null })
  })
})

describe('the design against what was asked', () => {
  it('counts doors and drawer fronts by their pieces', () => {
    expect(designParts(exampleWallCabinet)).toEqual({ doors: 2, drawers: 0 })
    expect(designParts(exampleBookcase)).toEqual({ doors: 0, drawers: 0 })
  })

  it('says which parts differ, and nothing for a part that was not asked', () => {
    expect(partsMismatch({ doors: 2, drawers: null }, exampleWallCabinet)).toEqual([])
    const off = partsMismatch({ doors: 4, drawers: 1 }, exampleWallCabinet)
    expect(off).toEqual([
      { part: 'doors', asked: 4, found: 2 },
      { part: 'drawers', asked: 1, found: 0 },
    ])
    expect(describeMismatch(off)).toBe('Se pidieron 4 puertas y la ficha tiene 2. Se pidió 1 cajón y la ficha tiene 0.')
  })
})
