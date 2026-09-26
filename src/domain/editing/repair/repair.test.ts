import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { mm, ref, extent, makeJoint } from '../../design/builders'
import type { Design, Piece } from '../../design/schema'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { exampleWallCabinet } from '../../furniture/fixtures/wallCabinet'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { repairDesign } from './repair'

const shelf = (d: Design) => d.pieces.find((p) => p.id === 'shelf-1')!
const withPiece = (d: Design, id: string, change: (p: Piece) => Piece): Design => ({ ...d, pieces: d.pieces.map((p) => (p.id === id ? change(p) : p)) })
const valid = (d: Design) => analyze(d, testCatalog).valid
const box = (d: Design, id: string) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.geo.boxes.get(id)!
}

describe('repairDesign', () => {
  it('removes a piece that is a copy inside another one', () => {
    const broken = { ...exampleBookcase, pieces: [...exampleBookcase.pieces, { ...shelf(exampleBookcase), id: 'shelf-extra', name: 'Entrepaño extra' }] }
    expect(valid(broken)).toBe(false)
    const { design, repairs } = repairDesign(broken, testCatalog)
    expect(valid(design)).toBe(true)
    expect(design.pieces.some((p) => p.id === 'shelf-extra')).toBe(false)
    expect(repairs.map((r) => r.message)).toEqual(['Quité Entrepaño extra: estaba completa dentro de Entrepaño 1.'])
  })

  it('trims a shelf that runs into the side, up to the side', () => {
    const broken = withPiece(exampleBookcase, 'shelf-1', (p) => ({ ...p, x: { ...p.x, to: ref('furniture.x1') } }))
    const { design, repairs } = repairDesign(broken, testCatalog)
    expect(valid(design)).toBe(true)
    expect(box(design, 'shelf-1').x1).toBe(box(exampleBookcase, 'side-right').x0)
    expect(repairs[0].message).toBe('Recorté Entrepaño 1 hasta Lateral derecho: se encimaban 18 mm.')
  })

  it('moves a shelf that sinks into the bottom so it sits on it, keeping its thickness', () => {
    const broken = withPiece(exampleBookcase, 'shelf-1', (p) => ({ ...p, y: { from: ref('bottom.y1', -10), to: null, length: null } }))
    const { design, repairs } = repairDesign(broken, testCatalog)
    expect(valid(design)).toBe(true)
    const fixed = box(design, 'shelf-1')
    expect(fixed.y0).toBe(box(exampleBookcase, 'bottom').y1)
    expect(fixed.y1 - fixed.y0).toBe(18)
    expect(repairs[0].message).toMatch(/^Moví Entrepaño 1 junto a Piso/)
  })

  it('an overlay door sunk into the carcass with no room in front: the carcass steps back, the door keeps its size', () => {
    const door = box(exampleWallCabinet, 'door-left')
    const into = mm(door.z0 + 16)
    const broken = ['side-left', 'side-right', 'bottom', 'top'].reduce((d, id) => withPiece(d, id, (p) => ({ ...p, z: { ...p.z, to: into } })), exampleWallCabinet)
    expect(valid(broken)).toBe(false)
    const { design, repairs } = repairDesign(broken, testCatalog)
    expect(valid(design)).toBe(true)
    expect(box(design, 'door-left')).toEqual(door)
    expect(box(design, 'side-left').z1).toBe(door.z0)
    expect(repairs.every((r) => r.message.startsWith('Recorté') && !r.message.startsWith('Recorté Puerta'))).toBe(true)
  })

  it('a shelf that runs into a door is trimmed back; the door keeps its size', () => {
    const door = box(exampleWallCabinet, 'door-left')
    const broken = withPiece(exampleWallCabinet, 'shelf', (p) => ({ ...p, z: { ...p.z, to: mm(door.z1) } }))
    const { design, repairs } = repairDesign(broken, testCatalog)
    expect(valid(design)).toBe(true)
    expect(box(design, 'door-left')).toEqual(door)
    expect(box(design, 'shelf').z1).toBe(door.z0)
    expect(repairs.every((r) => r.message.startsWith('Recorté Entrepaño'))).toBe(true)
  })

  it('drops a joint between pieces that do not touch', () => {
    const broken = { ...exampleBookcase, joints: [...exampleBookcase.joints, makeJoint('j-loose', 'shelf-1', 'top', 'butt-screw')] }
    const { design, repairs } = repairDesign(broken, testCatalog)
    expect(valid(design)).toBe(true)
    expect(design.joints.some((u) => u.id === 'j-loose')).toBe(false)
    expect(repairs[0].code).toBe('E_JOINT_WITHOUT_CONTACT')
  })

  it('also repairs pieces the model grouped into parts', () => {
    const broken = withPiece(exampleBookcase, 'shelf-1', (p) => ({ ...p, group: 'carcass', x: { ...p.x, to: ref('furniture.x1') } }))
    expect(valid(repairDesign(broken, testCatalog).design)).toBe(true)
  })

  it('contacts a repair creates get their joints', () => {
    const broken = withPiece({ ...exampleBookcase, joints: exampleBookcase.joints.filter((u) => !(u.b === 'top' && u.a.startsWith('side'))) }, 'top', (p) => ({ ...p, x: extent(ref('furniture.x0'), ref('furniture.x1')) }))
    const { design } = repairDesign(broken, testCatalog)
    const a = analyze(design, testCatalog)
    expect(a.valid && a.warnings.filter((w) => w.code === 'W_CONTACT_WITHOUT_JOINT')).toEqual([])
    expect(design.joints.some((u) => [u.a, u.b].includes('top') && u.type === 'butt-screw')).toBe(true)
  })

  it('leaves a valid design alone', () => {
    expect(repairDesign(exampleBookcase, testCatalog)).toEqual({ design: exampleBookcase, repairs: [] })
  })
})
