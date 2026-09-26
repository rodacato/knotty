import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { startAt, endAt, makePiece, ref, extent } from '../design/builders'
import type { Design } from '../design/schema'
import { completeJoints } from '../design/joints'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildBed, type BedPlan } from '../modules/bed'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from '../modules/cabinet'
import { buildTable, type TablePlan } from '../modules/table'
import type { Cell } from '../reading/reading'
import { detectKind } from './typology'

const cell = (content: Cell['content'], extra: Partial<Cell> = {}): Cell => ({ height: 1, content, shelves: null, doors: null, ...extra })
const cabinet = (p: Partial<CabinetPlan>) =>
  buildCabinet({ kind: 'cabinet', name: 'Mueble', dimensions: { width: 600, height: 900, depth: 450 }, material: 'T18', base: 'floor', wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [cell('open')] }], ...p }, testCatalog).design
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
  ])('%s → %s', (name, kind) => expect(detectKind({ name })).toBe(kind))

  it('what the design says wins over its name; without it, the name decides', () => {
    expect(detectKind({ name: 'Mueble', kind: 'wardrobe' })).toBe('wardrobe')
    expect(detectKind({ name: 'Librero', kind: 'bed' })).toBe('bed')
    expect(detectKind({ name: 'Librero', kind: undefined })).toBe('bookcase')
  })
})

describe('the kind is data, not the name', () => {
  const bedPlan: BedPlan = { kind: 'bed', name: 'Cama individual', mattress: 'individual', material: 'T18', height: 400, drawers: { side: 'none', count: 0, position: 'center' }, headboard: { style: 'plain', height: 1000, depth: 0, shelves: 0 } }

  it('a bed the module built keeps its checks and its mattress when renamed', () => {
    const bed = buildBed(bedPlan, testCatalog).design
    expect(bed).toMatchObject({ kind: 'bed', mattress: 'individual' })
    const renamed = { ...bed, name: 'Mueble de la recámara' }
    expect(detectKind(renamed)).toBe('bed')
    expect(usage(renamed)).toEqual([])
    // The mattress comes from the design, not from the name: a king on an individual base does not fit, whatever it is called.
    expect(usage({ ...renamed, name: 'Cama individual', mattress: 'king' })).toContainEqual(['critical', expect.stringContaining('El colchón king')])
  })

  it('a cabinet marked as a wardrobe gets the wardrobe checks under any name', () => {
    const wardrobe = { ...cabinet({ name: 'Mueble', dimensions: { width: 900, height: 1800, depth: 400 } }), kind: 'wardrobe' as const }
    // Anchoring it is R4's, by its doors and drawers and its height, whatever it is (structure/rules.test.ts).
    expect(usage(wardrobe)).toEqual([['recommendation', expect.stringContaining('los ganchos de ropa no caben')]])
    expect(usage({ ...wardrobe, kind: undefined })).toEqual([])
  })

  it('a table says which table it is: a coffee table named "comedor" is judged as a coffee table', () => {
    const plan: TablePlan = { kind: 'table', use: 'coffee', name: 'Mesa de comedor', material: 'T18', dimensions: { width: 1000, height: 420, depth: 550 }, overhang: 0, shelf: false, pedestal: { side: 'none', drawers: 0 } }
    const table = buildTable(plan, testCatalog).design
    expect(table.kind).toBe('coffeeTable')
    expect(usage(table)).toEqual([])
    expect(usage({ ...table, kind: undefined })).toEqual([['recommendation', expect.stringContaining('de comedor va de 720 a 770')]])
  })
})

describe('typologyRule', () => {
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
