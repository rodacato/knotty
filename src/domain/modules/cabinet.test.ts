import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { catalogo } from '../fixtures/catalogo.test-util'
import type { Cell } from '../reading/reading'
import { buildCabinet, type CabinetPlan } from './cabinet'

const cell = (content: Cell['content'], height = 1, extra: Partial<Cell> = {}): Cell => ({ height, content, shelves: null, doors: null, ...extra })
const plan = (p: Partial<CabinetPlan>): CabinetPlan => ({ name: 'Mueble', dimensions: { width: 600, height: 1800, depth: 300 }, material: 'T18', base: 'kick', wallMounted: true, columns: [{ width: 1, cells: [cell('open', 1, { shelves: 4 })] }], ...p })

const PLANS: Record<string, CabinetPlan> = {
  librero: plan({ name: 'Librero' }),
  buro: plan({ name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, base: 'floor', wallMounted: false, columns: [{ width: 1, cells: [cell('open', 0.6, { shelves: 0 }), cell('drawer', 0.4)] }] }),
  alacena: plan({ name: 'Alacena', dimensions: { width: 760, height: 720, depth: 320 }, base: 'floor', columns: [{ width: 1, cells: [cell('door', 1, { doors: 2, shelves: 1 })] }] }),
  muebleTv: plan({
    name: 'Mueble de TV',
    dimensions: { width: 1600, height: 500, depth: 400 },
    wallMounted: false,
    columns: [{ width: 0.3, cells: [cell('door', 1, { doors: 1 })] }, { width: 0.4, cells: [cell('open', 1, { shelves: 1 })] }, { width: 0.3, cells: [cell('door', 1, { doors: 1 })] }],
  }),
  cajonera: plan({ name: 'Cajonera', dimensions: { width: 500, height: 900, depth: 450 }, wallMounted: false, columns: [{ width: 1, cells: [cell('drawer'), cell('drawer'), cell('drawer')] }] }),
  cabecera: plan({ name: 'Cabecera', dimensions: { width: 1030, height: 900, depth: 250 }, base: 'floor', columns: [{ width: 1, cells: [cell('closed', 0.4), cell('open', 0.6, { shelves: 1 })] }] }),
}

describe('buildCabinet', () => {
  it.each(Object.entries(PLANS))('builds a valid %s with no overlaps and every contact joined', (_, p) => {
    const { design, notes } = buildCabinet(p, catalogo)
    const a = analizar(design, catalogo)
    if (!a.valido) throw new Error(a.errores.map((e) => e.mensaje).join('\n'))
    expect(a.avisos.filter((w) => w.codigo === 'A_CONTACTO_SIN_UNION')).toEqual([])
    expect(notes).toEqual([])
  })

  it('makes one drawer per drawer cell, with slides', () => {
    const { design } = buildCabinet(PLANS.cajonera, catalogo)
    expect(new Set(design.piezas.map((p) => p.grupo).filter(Boolean))).toEqual(new Set(['cajon-1', 'cajon-2', 'cajon-3']))
    expect(design.uniones.filter((u) => u.tipo === 'corredera').length).toBeGreaterThanOrEqual(3)
  })

  it('hangs each door and puts movable shelves on supports', () => {
    const { design } = buildCabinet(PLANS.alacena, catalogo)
    expect(design.uniones.filter((u) => u.tipo === 'bisagra-cazoleta').map((u) => u.a).sort()).toEqual(['c1-h1-puerta-der', 'c1-h1-puerta-izq'])
    expect(design.uniones.filter((u) => u.tipo === 'soporte-repisa')).toHaveLength(2)
  })

  it('a drawer too shallow for any slide stays as an open cell, and says so', () => {
    const { design, notes } = buildCabinet(plan({ dimensions: { width: 500, height: 400, depth: 250 }, columns: [{ width: 1, cells: [cell('drawer')] }] }), catalogo)
    expect(design.piezas.some((p) => p.grupo)).toBe(false)
    expect(notes[0]).toMatch(/^Cajón 1: No cabe un cajón/)
  })

  it('scales column widths and cell heights that do not add up to 1', () => {
    const { design } = buildCabinet(plan({ columns: [{ width: 2, cells: [cell('open', 3)] }, { width: 2, cells: [cell('open', 3)] }] }), catalogo)
    const a = analizar(design, catalogo)
    if (!a.valido) throw new Error(a.errores[0].mensaje)
    expect(a.geo.cajas.get('div-1')!.x0).toBe(291)
  })
})
