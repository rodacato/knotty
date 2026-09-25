import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import type { Diseno } from '../diseno/esquema'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { layOut } from './layout'
import { hardwarePerJoint, estimatePurchase, edgeBandingMeters } from './purchase'

const geo = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a.geo
}

describe('sheet layout', () => {
  it.each([librero, buro, alacena])('places everything without overlaps, inside the usable sheet and along the grain: $nombre', (d) => {
    const g = geo(d)
    for (const m of layOut(d, g, catalogo)) {
      expect(m.unplaced).toEqual([])
      const piezas = d.piezas.filter((p) => p.material === m.material)
      expect(m.sheets.flatMap((h) => h.placed).map((c) => c.id).sort()).toEqual(piezas.map((p) => p.id).sort())
      for (const h of m.sheets) {
        for (const c of h.placed) {
          expect(c.x + c.w).toBeLessThanOrEqual(m.usable.largo)
          expect(c.y + c.h).toBeLessThanOrEqual(m.usable.ancho)
          const p = piezas.find((x) => x.id === c.id)!
          if (p.veta === 'largo') expect(c.w).toBeGreaterThanOrEqual(c.h)
        }
        for (const [i, a] of h.placed.entries())
          for (const b of h.placed.slice(i + 1)) {
            const separadas = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
            expect(separadas, `${a.id} y ${b.id} se enciman`).toBe(true)
          }
        expect(h.waste).toBeGreaterThan(0)
        expect(h.waste).toBeLessThan(1)
      }
    }
  })

  it('the 60 cm bookcase takes one 18 mm sheet and one back sheet', () => {
    const r = estimatePurchase(librero, geo(librero), catalogo)
    expect(r.sheets.map((h) => [h.material.id, h.sheets])).toEqual([
      ['T18', 1],
      ['TR6', 1],
    ])
  })

  it('wider takes more sheets', () => {
    const ancho = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 1100 } }
    const hojas = estimatePurchase(ancho, geo(ancho), catalogo).sheets.find((h) => h.material.id === 'T18')!.sheets
    expect(hojas).toBe(2)
  })

  it('a piece larger than the sheet is left unplaced and counts as a sheet of its own', () => {
    const g = geo(librero)
    const enorme = { ...catalogo, materiales: catalogo.materiales.map((m) => (m.id === 'TR6' ? { ...m, hoja: { largo: 1500, ancho: 1220 } } : m)) }
    const tr6 = layOut(librero, g, enorme).find((m) => m.material === 'TR6')!
    expect(tr6.unplaced.map((p) => p.id)).toEqual(['trasera'])
  })
})

describe('hardware and purchase', () => {
  it('works out screws and nails by spacing along the joint', () => {
    const g = geo(librero)
    const joint = (id: string) => librero.uniones.find((u) => u.id === id)!
    expect(hardwarePerJoint(joint('u-piso-izq'), g)).toBe(2)
    expect(hardwarePerJoint(joint('u-trasera-lat-izq'), g)).toBe(13)
  })

  it('adds up edge banding for the marked edges, with waste', () => {
    expect(edgeBandingMeters(librero, geo(librero))).toBeCloseTo(((1800 * 2 + 564 * 6) / 1000) * 1.1, 1)
  })

  it('builds the list with packs and total cost', () => {
    const r = estimatePurchase(alacena, geo(alacena), catalogo)
    const bisagras = r.hardware.find((h) => h.hardware.id === 'bisagra-cazoleta-35-recta')!
    expect(bisagras).toMatchObject({ count: 4, packs: 2 })
    expect(r.hardware.some((h) => h.hardware.id === 'pegamento-blanco')).toBe(true)
    expect(r.cost.missingPrices).toEqual([])
    expect(r.cost.total).toBe(r.sheets.reduce((s, h) => s + h.cost!, 0) + r.hardware.reduce((s, h) => s + h.cost!, 0))
  })

  it('says which prices are missing', () => {
    const sinPrecio = { ...catalogo, materiales: catalogo.materiales.map((m) => ({ ...m, precio: null })) }
    const r = estimatePurchase(librero, geo(librero), sinPrecio)
    expect(r.cost.missingPrices).toContain('Triplay de pino 18 mm')
  })
})
