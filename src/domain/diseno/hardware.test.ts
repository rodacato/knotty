import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { buildCabinet, DEFAULT_CONSTRUCTION } from '../modules/cabinet'
import { aplicar } from '../operaciones/aplicar'
import { hardwareParts } from './hardware'

describe('hardware to draw', () => {
  it('puts a runner in the gap beside each drawer side, as long as the side', () => {
    const r = aplicar({ ...librero, dimensiones: { ...librero.dimensiones, fondo: 500 } }, [
      { op: 'agregarCajon', grupo: 'cajon-1', nombre: 'Cajón 1', izquierda: 'lat-izq.x1', derecha: 'lat-der.x0', abajo: 'piso.y1', arriba: 'entrepano-1.y0', frente: 'mueble.z1', fondo: 'trasera.z1', material: 'T15', materialFondo: 'TR6' },
    ], catalogo)
    if (!r.ok) throw new Error('no drawer')
    const geo = analizar(r.valor.diseno, catalogo).geo!
    const runners = hardwareParts(r.valor.diseno, geo.cajas).filter((h) => h.kind === 'runner')
    expect(runners).toHaveLength(2)
    const left = runners[0] as Extract<(typeof runners)[number], { kind: 'runner' }>
    const side = geo.cajas.get('cajon-1-costado-izq')!
    expect(left.owner).toBe('cajon-1-costado-izq')
    expect(left.box.x0).toBe(18)
    expect(left.box.x1).toBeCloseTo(side.x0, 5)
    expect([left.box.z0, left.box.z1]).toEqual([side.z0, side.z1])
  })
  it('puts two hinge cups on the inside of each door of a short cabinet, at the edge with the hinge', () => {
    const { design } = buildCabinet(
      { name: 'Alacena', dimensions: { width: 760, height: 720, depth: 320 }, material: 'T18', base: 'floor', wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'door', shelves: 1, doors: 2 }] }] },
      catalogo,
    )
    const geo = analizar(design, catalogo).geo!
    const hinges = hardwareParts(design, geo.cajas).filter((h) => h.kind === 'hinge')
    expect(hinges).toHaveLength(4)
    for (const h of hinges) {
      if (h.kind !== 'hinge') continue
      const door = geo.cajas.get(h.owner)!
      expect(h.center[2]).toBe(door.z0)
      expect(Math.min(h.center[0] - door.x0, door.x1 - h.center[0])).toBeCloseTo(22.5, 5)
    }
  })
})
