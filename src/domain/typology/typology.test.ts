import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { desde, hasta, pieza, ref, tramo } from '../diseno/construir'
import type { Diseno } from '../diseno/esquema'
import { completeJoints } from '../diseno/joints'
import { catalogo } from '../fixtures/catalogo.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../modules/cabinet'
import type { Cell } from '../reading/reading'
import { detectKind } from './typology'

const cell = (content: Cell['content'], extra: Partial<Cell> = {}): Cell => ({ height: 1, content, shelves: null, doors: null, ...extra })
const cabinet = (p: Partial<CabinetPlan>) =>
  buildCabinet({ name: 'Mueble', dimensions: { width: 600, height: 900, depth: 450 }, material: 'T18', base: 'floor', wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [cell('open')] }], ...p }, catalogo).design
const usage = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(a.errores[0].mensaje)
  return a.hallazgos.filter((h) => h.codigo === 'R10_USO').map((h) => [h.severidad, h.mensaje] as const)
}

describe('detectKind', () => {
  it.each([
    ['Cama individual con cabecera', 'bed'],
    ['Escritorio sencillo', 'desk'],
    ['Mesa de centro', 'table'],
    ['Buró con cajón', 'drawers'],
    ['Alacena de pared', 'wallCabinet'],
    ['Librero 5 repisas', 'bookcase'],
    ['Zapatera', 'shoeRack'],
    ['Mueble de TV', null],
  ])('%s → %s', (nombre, kind) => expect(detectKind({ nombre })).toBe(kind))
})

describe('typologyRule', () => {
  it('a tall chest of drawers must be anchored', () => {
    const plan = { name: 'Cajonera', columns: [{ width: 1, cells: [cell('drawer'), cell('drawer'), cell('drawer')] }] }
    expect(usage(cabinet(plan))[0]).toEqual(['critico', expect.stringContaining('se va de frente')])
    expect(usage(cabinet({ ...plan, wallMounted: true }))).toEqual([])
  })

  it('a wall cabinet hangs from the wall', () => {
    expect(usage(cabinet({ name: 'Alacena', dimensions: { width: 760, height: 720, depth: 320 } })).map(([s]) => s)).toEqual(['critico', 'recomendacion'])
  })

  it('a shallow bookcase leaves books sticking out', () => {
    expect(usage(cabinet({ name: 'Librero', dimensions: { width: 600, height: 1800, depth: 200 }, wallMounted: true }))).toEqual([['recomendacion', expect.stringContaining('200 mm de fondo')]])
  })

  it('a bed whose platform is narrower than the mattress, or spans too far without support', () => {
    const narrow = usage(cabinet({ name: 'Cama individual', dimensions: { width: 1000, height: 350, depth: 1900 } }))
    expect(narrow).toContainEqual(['critico', expect.stringContaining('no cabe')])
    const unsupported = usage(cabinet({ name: 'Cama individual', dimensions: { width: 1030, height: 350, depth: 1900 } }))
    expect(unsupported).not.toContainEqual(['critico', expect.stringContaining('no cabe')])
    expect(unsupported).toContainEqual(['critico', expect.stringContaining('sin apoyo')])
  })

  it('a bed lying the other way still fits its mattress', () => {
    const sideways = usage(cabinet({ name: 'Cama individual', dimensions: { width: 1940, height: 350, depth: 1030 } }))
    expect(sideways).not.toContainEqual(['critico', expect.stringContaining('no cabe')])
  })

  it('a desk needs room for the legs', () => {
    expect(usage(cabinet({ name: 'Escritorio', dimensions: { width: 1200, height: 750, depth: 600 } }))).toContainEqual(['critico', expect.stringContaining('espacio para las piernas')])
    const open: Diseno = completeJoints(
      {
        esquema: 1,
        nombre: 'Escritorio',
        dimensiones: { ancho: 1200, alto: 750, fondo: 600 },
        anclajeMuro: false,
        observaciones: '',
        uniones: [],
        piezas: [
          pieza({ id: 'lat-izq', nombre: 'Pata izquierda', rol: 'lateral', material: 'T18', normal: 'x', x: desde(ref('mueble.x0')), y: tramo(ref('mueble.y0'), ref('cubierta.y0')), z: tramo(ref('mueble.z0'), ref('mueble.z1')) }),
          pieza({ id: 'lat-der', nombre: 'Pata derecha', rol: 'lateral', material: 'T18', normal: 'x', x: hasta(ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('cubierta.y0')), z: tramo(ref('mueble.z0'), ref('mueble.z1')) }),
          pieza({ id: 'cubierta', nombre: 'Cubierta', rol: 'techo', material: 'T18', normal: 'y', x: tramo(ref('mueble.x0'), ref('mueble.x1')), y: hasta(ref('mueble.y1')), z: tramo(ref('mueble.z0'), ref('mueble.z1')) }),
          pieza({ id: 'faldon', nombre: 'Faldón', rol: 'faja', material: 'T18', normal: 'z', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: tramo(null, ref('cubierta.y0'), 150), z: desde(ref('mueble.z0')) }),
        ],
      },
      catalogo,
    )
    expect(usage(open)).toEqual([])
  })

  it('a coffee table at dining height', () => {
    expect(usage(cabinet({ name: 'Mesa de centro', dimensions: { width: 1000, height: 750, depth: 550 } }))).toEqual([['recomendacion', expect.stringContaining('de centro va de 350 a 500')]])
  })
})
