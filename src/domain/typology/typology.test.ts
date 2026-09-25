import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { startAt, endAt, makePiece, ref, extent } from '../design/builders'
import type { Design } from '../design/schema'
import { completeJoints } from '../design/joints'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../modules/cabinet'
import type { Cell } from '../reading/reading'
import { detectKind } from './typology'

const cell = (content: Cell['content'], extra: Partial<Cell> = {}): Cell => ({ height: 1, content, shelves: null, doors: null, ...extra })
const cabinet = (p: Partial<CabinetPlan>) =>
  buildCabinet({ name: 'Mueble', dimensions: { width: 600, height: 900, depth: 450 }, material: 'T18', base: 'floor', wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [cell('open')] }], ...p }, testCatalog).design
const usage = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.findings.filter((h) => h.code === 'R10_USE').map((h) => [h.severity, h.message] as const)
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
  ])('%s → %s', (nombre, kind) => expect(detectKind({ name: nombre })).toBe(kind))
})

describe('typologyRule', () => {
  it('a tall chest of drawers must be anchored', () => {
    const plan = { name: 'Cajonera', columns: [{ width: 1, cells: [cell('drawer'), cell('drawer'), cell('drawer')] }] }
    expect(usage(cabinet(plan))[0]).toEqual(['critical', expect.stringContaining('se va de frente')])
    expect(usage(cabinet({ ...plan, wallMounted: true }))).toEqual([])
  })

  it('a wall cabinet hangs from the wall', () => {
    expect(usage(cabinet({ name: 'Alacena', dimensions: { width: 760, height: 720, depth: 320 } })).map(([s]) => s)).toEqual(['critical', 'recommendation'])
  })

  it('a shallow bookcase leaves books sticking out', () => {
    expect(usage(cabinet({ name: 'Librero', dimensions: { width: 600, height: 1800, depth: 200 }, wallMounted: true }))).toEqual([['recommendation', expect.stringContaining('200 mm de fondo')]])
  })

  it('a bed whose platform is narrower than the mattress, or spans too far without support', () => {
    const narrow = usage(cabinet({ name: 'Cama individual', dimensions: { width: 1000, height: 350, depth: 1900 } }))
    expect(narrow).toContainEqual(['critical', expect.stringContaining('no cabe')])
    const unsupported = usage(cabinet({ name: 'Cama individual', dimensions: { width: 1030, height: 350, depth: 1900 } }))
    expect(unsupported).not.toContainEqual(['critical', expect.stringContaining('no cabe')])
    expect(unsupported).toContainEqual(['critical', expect.stringContaining('sin apoyo')])
  })

  it('a bed lying the other way still fits its mattress', () => {
    const sideways = usage(cabinet({ name: 'Cama individual', dimensions: { width: 1940, height: 350, depth: 1030 } }))
    expect(sideways).not.toContainEqual(['critical', expect.stringContaining('no cabe')])
  })

  it('a desk needs room for the legs', () => {
    expect(usage(cabinet({ name: 'Escritorio', dimensions: { width: 1200, height: 750, depth: 600 } }))).toContainEqual(['critical', expect.stringContaining('espacio para las piernas')])
    const open: Design = completeJoints(
      {
        schema: 1,
        name: 'Escritorio',
        dimensions: { width: 1200, height: 750, depth: 600 },
        wallAnchored: false,
        notes: '',
        joints: [],
        pieces: [
          makePiece({ id: 'side-left', name: 'Pata izquierda', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('top.y0')), z: extent(ref('furniture.z0'), ref('furniture.z1')) }),
          makePiece({ id: 'side-right', name: 'Pata derecha', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('top.y0')), z: extent(ref('furniture.z0'), ref('furniture.z1')) }),
          makePiece({ id: 'top', name: 'Cubierta', role: 'top', material: 'T18', normal: 'y', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: endAt(ref('furniture.y1')), z: extent(ref('furniture.z0'), ref('furniture.z1')) }),
          makePiece({ id: 'apron', name: 'Faldón', role: 'apron', material: 'T18', normal: 'z', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: extent(null, ref('top.y0'), 150), z: startAt(ref('furniture.z0')) }),
        ],
      },
      testCatalog,
    )
    expect(usage(open)).toEqual([])
  })

  it('a coffee table at dining height', () => {
    expect(usage(cabinet({ name: 'Mesa de centro', dimensions: { width: 1000, height: 750, depth: 550 } }))).toEqual([['recommendation', expect.stringContaining('de centro va de 350 a 500')]])
  })
})
