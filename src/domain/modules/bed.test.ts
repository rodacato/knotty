import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { catalogo } from '../fixtures/catalogo.test-util'
import { buildBed, type BedPlan } from './bed'

const bed = (p: Partial<BedPlan> = {}): BedPlan => ({
  kind: 'bed',
  name: 'Cama',
  mattress: 'individual',
  material: 'T18',
  height: 400,
  drawers: { side: 'none', count: 3, position: 'head' },
  headboard: { style: 'none', height: 1100, depth: 250, shelves: 2 },
  ...p,
})

const STYLES = ['none', 'plain', 'bookcase', 'storage'] as const
const SIDES = ['none', 'left', 'right', 'both'] as const
const MATTRESSES = ['individual', 'matrimonial', 'queen', 'king'] as const

describe('buildBed', () => {
  it.each(MATTRESSES.flatMap((mattress) => STYLES.flatMap((style) => SIDES.map((side) => [mattress, style, side] as const))))('%s, headboard %s, drawers %s: valid, with nothing to warn about', (mattress, style, side) => {
    const { design, notes } = buildBed(bed({ mattress, drawers: { side, count: 3, position: 'head' }, headboard: { style, height: 1100, depth: 250, shelves: 2 } }), catalogo)
    const a = analizar(design, catalogo)
    if (!a.valido) throw new Error(JSON.stringify(a.errores.slice(0, 3)))
    expect(notes).toEqual([])
    expect(a.hallazgos.map((h) => h.mensaje)).toEqual([])
  })
  it('puts the drawers of the right side (seen from the foot) opening backward, and the left ones forward', () => {
    const { design } = buildBed(bed({ drawers: { side: 'both', count: 3, position: 'head' } }), catalogo)
    const geo = analizar(design, catalogo).geo!
    const fronts = design.piezas.filter((p) => p.rol === 'frente-cajon')
    expect(fronts).toHaveLength(6)
    expect(fronts.filter((p) => geo.cajas.get(p.id)!.z0 === 0).map((p) => p.grupo)).toEqual(['cajon-der-1', 'cajon-der-2', 'cajon-der-3'])
    expect(fronts.filter((p) => geo.cajas.get(p.id)!.z1 === design.dimensiones.fondo)).toHaveLength(3)
  })

  it('gathers fewer drawers toward the foot and closes the rest of the side, with cross members under the platform', () => {
    const { design } = buildBed(bed({ drawers: { side: 'left', count: 1, position: 'foot' } }), catalogo)
    const geo = analizar(design, catalogo).geo!
    const front = geo.cajas.get('cajon-izq-1-frente')!
    expect(geo.cajas.get('base-pie')!.x0 - front.x1).toBeCloseTo(2, 5)
    expect(design.piezas.some((p) => p.id === 'costado-izq-1')).toBe(true)
    expect(design.piezas.filter((p) => p.id.startsWith('travesano-izq')).length).toBeGreaterThan(0)
  })

  it('makes a storage headboard with a closed compartment at pillow level and shelves above', () => {
    const { design } = buildBed(bed({ headboard: { style: 'storage', height: 1200, depth: 250, shelves: 2 } }), catalogo)
    const geo = analizar(design, catalogo).geo!
    const floor = geo.cajas.get('cab-piso')!
    expect(floor.y1).toBe(400)
    expect(geo.cajas.get('cab-sep')!.y0).toBe(400 + 280)
    expect(design.piezas.filter((p) => p.id.startsWith('cab-rep-'))).toHaveLength(2)
    expect(design.dimensiones).toEqual({ ancho: 250 + 1900 + 20 + 18, alto: 1200, fondo: 990 + 20 })
  })
})
