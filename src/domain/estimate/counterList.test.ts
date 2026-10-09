import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import type { Design, Piece } from '../design/schema'
import { applyOperations } from '../editing/operations/apply'
import { exampleDesign, exampleOf } from '../furniture/examples'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { testReferences } from '../furniture/fixtures/references.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../furniture/modules/cabinet'
import { applySettings, type Catalog } from '../materials/catalog'
import { counterLines, counterList } from './counterList'
import { cutList } from './cutList'
import { estimatePurchase } from './purchase'

const geoOf = (design: Design, catalog: Catalog) => {
  const { geo } = analyze(design, catalog)
  if (!geo) throw new Error(`${design.name} has no geometry`)
  return geo
}

const said = (design: Design, catalog: Catalog = testCatalog) => {
  const geo = geoOf(design, catalog)
  return counterList(design, geo, estimatePurchase(design, geo, catalog), catalog.layout)
}

const lined = (design: Design, catalog: Catalog = testCatalog) => {
  const geo = geoOf(design, catalog)
  return counterLines(design, geo, estimatePurchase(design, geo, catalog))
}

const ficha = (code: string) => exampleDesign(exampleOf(testReferences.latest(code)!), testCatalog).design

/** The numbered lines of a message, read as a counter would: a number, a name, two whole measures and how many pieces. */
const numbered = (text: string) =>
  text.split('\n').flatMap((line) => {
    const [, number, count] = /^(\d+)\. .+ · \d+ × \d+(?: \(redondeado\))? · (\d+) piezas?(?: · |$)/.exec(line) ?? []
    return number ? [{ number: Number(number), count: Number(count), line }] : []
  })

const lineOf = (text: string, name: string) => numbered(text).find((l) => l.line.includes(`. ${name} · `))?.line

const changed = (design: Design, id: string, change: Partial<Pick<Piece, 'grain' | 'edges'>>) => {
  const r = applyOperations(design, [{ op: 'changeProperties', id, name: null, role: null, grain: null, load: null, support: null, edges: null, confidence: null, ...change }], testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value.design
}

describe('the cut list for the lumberyard: the open bookcase (GN-LIB-01)', () => {
  const design = ficha('GN-LIB-01')
  const text = said(design)
  const purchase = estimatePurchase(design, geoOf(design, testCatalog), testCatalog)

  it('opens with the furniture, what the measures are and what the sheets were counted with, said once', () => {
    expect(text.split('\n').slice(0, 4)).toEqual([
      'Lista de corte: Librero abierto',
      'Medidas finales de cada pieza: el disco va aparte. Las piezas del mismo renglón, con el mismo tope. Calculé las hojas con disco de 4 mm y 15 mm de refilado por orilla; si el suyo es distinto, avísenme.',
      'Medidas en mm. El largo va con la veta.',
      '',
    ])
    expect(text.match(/Medidas finales|disco de|refila/gi)).toEqual(['Medidas finales', 'disco de', 'refila'])
  })

  it('heads each material with its sheets as the store sells them, and never with a bare saw cut a counter could take off each piece', () => {
    const [thick, back] = purchase.sheets
    expect([thick.material.id, back.material.id]).toEqual(['T18', 'TR6'])
    const plural = (n: number) => `${n} ${n === 1 ? 'hoja' : 'hojas'}`
    expect(text).toContain(`\n\nTriplay de pino 18 mm · ${plural(thick.sheets)} de 1218 × 2440\n\n1. `)
    expect(text).toContain(`\n\nTriplay de pino 6 mm (trasera) · ${plural(back.sheets)} de 1218 × 2440\n\n`)
    expect(text).not.toMatch(/corte \d+ mm|Refilado|por lado/)
  })

  it('numbers the lines from 1 without gaps, and goes on counting in the second material', () => {
    const lines = numbered(text)
    expect(lines.map((l) => l.number)).toEqual(lines.map((_, i) => i + 1))
    const afterBackHeader = text.slice(text.indexOf('Triplay de pino 6 mm'))
    expect(numbered(afterBackHeader).map((l) => l.number)).toEqual([lines.length])
    expect(lineOf(text, 'Trasera')).toBe(`${lines.length}. Trasera · 1950 × 900 · 1 pieza`)
  })

  it('accounts for every piece exactly once', () => {
    expect(numbered(text).reduce((n, l) => n + l.count, 0)).toBe(design.pieces.length)
  })

  it('names every piece of a shared line, saying a run of numbers once', () => {
    expect(text).toContain('. Lateral izquierdo, Lateral derecho · 1950 × 284 · 2 piezas · cubrecanto: un largo\n')
    const shelves = design.pieces.filter((p) => p.role === 'shelf').map((p) => p.name)
    expect(shelves).toHaveLength(10)
    expect(shelves).toContain('Repisa 2 de la columna 2 (hueco 1)')
    expect(text).toContain('. Entrepaño fijo 1.1, Repisa 1 y 2 de la columna 1 y 2 (hueco 1 y 2), Entrepaño fijo 2.1 · 423 × 284 · 10 piezas · ')
  })
})

describe('the cut list for the lumberyard: every ficha', () => {
  const designs = testReferences.all().map((r) => ({ code: r.code, design: exampleDesign(exampleOf(r), testCatalog).design }))

  it.each(designs)('$code: every piece is on one numbered line, and nothing a counter should not read is there', ({ design }) => {
    const text = said(design)
    const lines = numbered(text)
    expect(lines.map((l) => l.number)).toEqual(lines.map((_, i) => i + 1))
    expect(lines.reduce((n, l) => n + l.count, 0)).toBe(design.pieces.length)
    expect(text).not.toMatch(/\$|precio|gratis|sin costo|espesor real|medido|cortar al final|desperdicio/i)
    expect(text).not.toMatch(/[ \t]+(\n|$)|\r|\t|\|/)
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(said(design)).toBe(text)
  })

  it.each(designs)('$code: the lines the screen shows are the lines of the message, under the same numbers', ({ design }) => {
    const lines = lined(design).flatMap((block) => block.lines)
    const text = numbered(said(design))
    expect(lines.map((l) => ({ number: l.number, count: l.count }))).toEqual(text.map((l) => ({ number: l.number, count: l.count })))
    for (const [i, l] of lines.entries()) expect(text[i].line.startsWith(`${l.number}. ${l.names} · ${l.length} × ${l.width}${l.rounded ? ' (redondeado)' : ''} · `)).toBe(true)
    expect(lines.flatMap((l) => l.ids).sort()).toEqual(design.pieces.map((p) => p.id).sort())
    expect(lines.every((l) => l.count === l.ids.length)).toBe(true)
  })
})

describe('the cut list for the lumberyard: length goes with the grain', () => {
  it('puts the shorter side first when the grain runs along it, and names the banded edge by that length', () => {
    const before = said(exampleBookcase)
    expect(before).toContain('. Piso, Techo, Entrepaño 1 a 4 · 514 × 294 · 6 piezas · cubrecanto: un largo\n')
    const after = said(changed(exampleBookcase, 'shelf-1', { grain: 'width' }))
    expect(lineOf(after, 'Entrepaño 1')).toMatch(/^\d+\. Entrepaño 1 · 294 × 514 · 1 pieza · veta a lo largo \(294\) · cubrecanto: un ancho$/)
    expect(after).toContain('. Piso, Techo, Entrepaño 2 a 4 · 514 × 294 · 5 piezas · cubrecanto: un largo\n')
  })

  it('says the grain is free on a board that can be turned, with its longer side first', () => {
    const text = said(changed(exampleBookcase, 'shelf-1', { grain: 'any' }))
    expect(lineOf(text, 'Entrepaño 1')).toMatch(/· 514 × 294 · 1 pieza · veta libre · cubrecanto: un largo$/)
    expect(numbered(text).filter((l) => l.line.includes('veta libre'))).toHaveLength(1)
  })

  it('says it of the drawer bottoms a module builds, and of no other board', () => {
    const design = ficha('KC-BUR-01')
    const free = design.pieces.filter((p) => p.grain === 'any')
    expect(free.map((p) => p.role)).toEqual(['drawer-bottom'])
    const lines = numbered(said(design)).filter((l) => l.line.includes('veta libre'))
    expect(lines.map((l) => l.line.split(' · ')[0].replace(/^\d+\. /, ''))).toEqual([free[0].name])
  })
})

describe('the cut list for the lumberyard: what makes two boards one line', () => {
  it('keeps apart two boards of the same size banded on different edges', () => {
    const text = said(changed(exampleBookcase, 'shelf-1', { edges: ['front', 'back'] }))
    expect(lineOf(text, 'Entrepaño 1')).toMatch(/· 514 × 294 · 1 pieza · cubrecanto: dos largos$/)
    expect(text).toContain('. Piso, Techo, Entrepaño 2 a 4 · 514 × 294 · 5 piezas · cubrecanto: un largo\n')
  })

  it('counts the same edge once and ignores a face named as an edge', () => {
    const text = said(changed(exampleBookcase, 'shelf-1', { edges: ['front', 'front', 'top', 'bottom'] }))
    expect(text).toContain('. Piso, Techo, Entrepaño 1 a 4 · 514 × 294 · 6 piezas · cubrecanto: un largo\n')
  })

  it('names the four edges of a banded front, and both kinds when a long and a short edge are banded', () => {
    expect(lineOf(said(ficha('KC-BUR-01')), 'Frente de cajón 1')).toMatch(/· 1 pieza · cubrecanto: los cuatro cantos$/)
    expect(lineOf(said(changed(exampleBookcase, 'shelf-1', { edges: ['front', 'left'] })), 'Entrepaño 1')).toMatch(/· cubrecanto: un largo y un ancho$/)
    expect(lineOf(said(changed(exampleBookcase, 'shelf-1', { edges: [] })), 'Entrepaño 1')).toMatch(/· 514 × 294 · 1 pieza$/)
  })

  it('keeps apart two doors of the same size when only one gets a notch, where the list by role makes one row', () => {
    const cell = { height: 1, content: 'door', shelves: 1, doors: 1 } as const
    const plan: CabinetPlan = {
      kind: 'cabinet', name: 'Aparador', dimensions: { width: 1200, height: 800, depth: 400 }, material: 'T18', base: 'legs', legHeight: 150, wallMounted: false, construction: DEFAULT_CONSTRUCTION,
      columns: [{ width: 1, cells: [{ ...cell, own: { pulls: 'notch' } }] }, { width: 1, cells: [cell] }],
    }
    const { design } = buildCabinet(plan, testCatalog)
    expect(cutList(design, geoOf(design, testCatalog)).find((l) => l.name === 'Puerta de la columna')?.count).toBe(2)
    const doors = said(design).split('\n').flatMap((line, i, all) => (/\. Puerta de la columna \d/.test(line) ? [[line.replace(/^\d+/, '#'), all[i + 1]]] : []))
    expect(doors).toHaveLength(2)
    const [notched, plain] = doors
    expect(notched[0].replace('columna 1', 'columna 2')).toBe(plain[0])
    expect(notched[1]).toBe('   Después de cortarla: saques o ranuras')
    expect(plain[1]).not.toContain('Después')
    const onScreen = lined(design).flatMap((block) => block.lines).filter((l) => /^Puerta de la columna \d$/.test(l.names))
    expect(onScreen.map((l) => l.after)).toEqual(['Después de cortarla: saques o ranuras', null])
  })

  it('carries on each line what the message says of it: the grain, the banded edges and the boards that do not fit', () => {
    const turned = lined(changed(exampleBookcase, 'shelf-1', { grain: 'width' })).flatMap((block) => block.lines).find((l) => l.names === 'Entrepaño 1')!
    expect(turned).toMatchObject({ length: 294, width: 514, count: 1, rounded: false, grain: 'veta a lo largo (294)', banding: 'cubrecanto: un ancho', after: null, ids: ['shelf-1'] })
    const shortSheets = { ...testCatalog, materials: testCatalog.materials.map((m) => (m.id === 'TR6' ? { ...m, sheet: { length: 1500, width: 1220 } } : m)) }
    expect(lined(exampleBookcase, shortSheets).map((block) => [block.name, block.unplaced])).toEqual([['Triplay de pino 18 mm', []], ['Triplay de pino 6 mm (trasera)', ['Trasera']]])
  })
})

describe('the cut list for the lumberyard: measures and settings', () => {
  it('takes a measure that is not whole down to the millimetre and says so on that line only', () => {
    const design = ficha('KC-BUR-01')
    const box = geoOf(design, testCatalog).boxes.get(design.pieces.find((p) => p.name === 'Contrafrente de cajón 1')!.id)!
    const length = box.x1 - box.x0
    expect(length % 1).toBeGreaterThan(0.5)
    const text = said(design)
    expect(lineOf(text, 'Contrafrente de cajón 1, Trasera de cajón 1')).toContain(` · ${Math.floor(length)} × 110 (redondeado) · 2 piezas · `)
    expect(lineOf(text, 'Costado izquierdo de cajón 1, Costado derecho de cajón 1')).toContain(' · 300 × 110 · 2 piezas · ')
  })

  it("prints the person's trim and saw cut, and says when the sheet is not trimmed", () => {
    const mine = (trim: number) => applySettings(testCatalog, { prices: { T18: 999 }, layout: { trim, kerf: 3, clearance: 2 } })
    expect(said(exampleBookcase, mine(10))).toContain(' Calculé las hojas con disco de 3 mm y 10 mm de refilado por orilla; si el suyo es distinto, avísenme.\n')
    const untrimmed = said(exampleBookcase, mine(0))
    expect(untrimmed).toContain(' Calculé las hojas con disco de 3 mm y sin refilar; si el suyo es distinto, avísenme.\n')
    expect(untrimmed).not.toMatch(/por orilla|999/)
    expect(said(exampleBookcase)).not.toMatch(/disco de 3 mm|sin refilar/)
  })

  it('names the boards that do not fit a sheet under the material they are cut from', () => {
    const shortSheets = { ...testCatalog, materials: testCatalog.materials.map((m) => (m.id === 'TR6' ? { ...m, sheet: { length: 1500, width: 1220 } } : m)) }
    const text = said(exampleBookcase, shortSheets)
    expect(text).toContain('\nTriplay de pino 6 mm (trasera) · 1 hoja de 1220 × 1500\nNo caben en una hoja: Trasera. Cuentan como hoja aparte.\n\n4. Trasera · 1800 × 550 · 1 pieza')
    expect(said(exampleBookcase)).not.toContain('No caben')
  })
})
