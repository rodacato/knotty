import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { cutBox } from '../../design/cuts'
import type { Box } from '../../design/resolve'
import { testCatalog } from '../fixtures/catalog.test-util'
import { buildCabinet, DEFAULT_CONSTRUCTION, type CabinetPlan } from './cabinet'
import { DEFAULT_FINGERS } from './fingerJoints'

const chest: CabinetPlan = {
  kind: 'cabinet',
  name: 'Cajonera',
  dimensions: { width: 500, height: 900, depth: 450 },
  material: 'T18',
  base: 'kick',
  legHeight: 150,
  wallMounted: false,
  construction: DEFAULT_CONSTRUCTION,
  columns: [{ width: 1, cells: [{ height: 1, content: 'drawer', shelves: null, doors: null }, { height: 1, content: 'drawer', shelves: null, doors: null }] }],
}
const fingered = (drawerFingers?: number): CabinetPlan => ({ ...chest, construction: { ...DEFAULT_CONSTRUCTION, drawerCorners: 'fingers' }, drawerFingers })

function build(plan: CabinetPlan) {
  const { design, notes } = buildCabinet(plan, testCatalog)
  const a = analyze(design, testCatalog)
  if (!a.valid) throw new Error(a.errors.map((e) => e.message).join('\n'))
  return { design, notes, a }
}

/** The wood left in a corner column, as the number of fingers each board keeps, counted along its height. */
function keptSlices(voids: Box[], column: Box, samples = 200) {
  const kept: boolean[] = []
  for (let i = 0; i < samples; i++) {
    const y = column.y0 + ((i + 0.5) * (column.y1 - column.y0)) / samples
    const cx = (column.x0 + column.x1) / 2
    const cz = (column.z0 + column.z1) / 2
    kept.push(!voids.some((v) => v.x0 <= cx && cx <= v.x1 && v.y0 <= y && y <= v.y1 && v.z0 <= cz && cz <= v.z1))
  }
  return kept.filter((k, i) => k !== kept[i - 1]).length
}

describe('drawer boxes with fingers', () => {
  it('is valid with nothing to warn about, and every corner of each drawer is a finger joint', () => {
    const { design, a } = build(fingered())
    expect(a.warnings).toEqual([])
    const joints = design.joints.filter((u) => u.type === 'finger')
    expect(joints.map((u) => u.id).sort()).toEqual(
      ['drawer-1', 'drawer-2'].flatMap((g) => ['side-left', 'side-right'].flatMap((s) => ['subfront', 'back'].map((e) => `j-${g}-${s}-${e}`))).sort(),
    )
    expect(joints.every((u) => u.glue && u.hardware.length === 0 && u.depth === 18)).toBe(true)
  })

  it('makes the front and the back as wide as the box: two boards of thickness longer', () => {
    const wide = (plan: CabinetPlan) => {
      const { a } = build(plan)
      return ['back', 'subfront'].map((part) => {
        const b = a.geo!.boxes.get(`drawer-1-${part}`)!
        return Math.round(b.x1 - b.x0)
      })
    }
    const [back, subfront] = wide(chest)
    const [fingerBack, fingerSubfront] = wide(fingered())
    expect(fingerBack).toBe(back + 2 * 18)
    expect(fingerSubfront).toBe(subfront + 2 * 18)
  })

  it('cuts each corner so that the two boards alternate: the count of fingers the person asked for', () => {
    for (const n of [3, 5, 9]) {
      const { design, a } = build(fingered(n))
      const side = design.pieces.find((p) => p.id === 'drawer-1-side-left')!
      const back = design.pieces.find((p) => p.id === 'drawer-1-back')!
      const sideBox = a.geo!.boxes.get(side.id)!
      const backBox = a.geo!.boxes.get(back.id)!
      const column: Box = { x0: Math.max(sideBox.x0, backBox.x0), x1: Math.min(sideBox.x1, backBox.x1), y0: Math.max(sideBox.y0, backBox.y0), y1: Math.min(sideBox.y1, backBox.y1), z0: Math.max(sideBox.z0, backBox.z0), z1: Math.min(sideBox.z1, backBox.z1) }
      const sideVoids = side.cuts!.map((c) => cutBox(sideBox, c))
      const backVoids = back.cuts!.map((c) => cutBox(backBox, c))
      // Each board is wood n times along the corner's column, and where one has wood the other has a hole.
      expect(keptSlices(sideVoids, column)).toBe(n)
      expect(keptSlices(backVoids, column)).toBe(n)
      const each = 200
      for (let i = 0; i < each; i++) {
        const y = column.y0 + ((i + 0.5) * (column.y1 - column.y0)) / each
        const cx = (column.x0 + column.x1) / 2
        const cz = (column.z0 + column.z1) / 2
        const hole = (voids: Box[]) => voids.some((v) => v.x0 <= cx && cx <= v.x1 && v.y0 <= y && y <= v.y1 && v.z0 <= cz && cz <= v.z1)
        expect(hole(sideVoids)).not.toBe(hole(backVoids))
      }
    }
  })

  it('the person does not have to say how many: absent is the default', () => {
    const { design } = build(fingered())
    const withDefault = build(fingered(DEFAULT_FINGERS)).design
    expect(design.pieces.map((p) => p.cuts)).toEqual(withDefault.pieces.map((p) => p.cuts))
  })

  it('says how they are cut, with the count', () => {
    const { notes } = build(fingered(7))
    expect(notes).toContain('Esquinas de dedos en 2 cajones, 7 por esquina: se cortan con router en mesa o con sierra de mesa y plantilla, y se arman con pegamento. Quedan a la vista.')
  })

  it('leaves a cabinet with screwed drawers as it was', () => {
    const { design, notes } = build(chest)
    expect(design.joints.some((u) => u.type === 'finger')).toBe(false)
    expect(design.pieces.every((p) => !p.cuts)).toBe(true)
    expect(notes).toEqual([])
  })
})
