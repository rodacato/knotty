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

describe('a cabinet top with fingers', () => {
  const topFingers = (extra: Partial<CabinetPlan> = {}): CabinetPlan => ({ ...chest, construction: { ...DEFAULT_CONSTRUCTION, top: 'fingers' }, ...extra })

  it('is valid with nothing to warn about, and the outer sides run up through the top', () => {
    const { design, a } = build(topFingers())
    expect(a.warnings).toEqual([])
    const side = a.geo!.boxes.get('side-left')!
    const top = a.geo!.boxes.get('top')!
    expect(side.y1).toBe(top.y1)
    expect(top.x1 - top.x0).toBe(500)
    expect(design.joints.filter((u) => u.type === 'finger').map((u) => [u.a, u.b, u.depth])).toEqual([['side-left', 'top', 18], ['side-right', 'top', 18]])
  })

  it('cuts the fingers along the depth, alternating between the side and the top', () => {
    for (const n of [3, 5, 9]) {
      const { design, a } = build(topFingers({ drawerFingers: n }))
      const [side, top] = [design.pieces.find((p) => p.id === 'side-left')!, design.pieces.find((p) => p.id === 'top')!]
      const [sideBox, topBox] = [a.geo!.boxes.get(side.id)!, a.geo!.boxes.get(top.id)!]
      const column: Box = { x0: sideBox.x0, x1: sideBox.x1, y0: topBox.y0, y1: topBox.y1, z0: sideBox.z0, z1: sideBox.z1 }
      const [sideVoids, topVoids] = [side.cuts!.map((c) => cutBox(sideBox, c)), top.cuts!.filter((c) => c.x.offset <= 1).map((c) => cutBox(topBox, c))]
      for (let i = 0; i < 200; i++) {
        const z = column.z0 + ((i + 0.5) * (column.z1 - column.z0)) / 200
        const hole = (voids: Box[]) => voids.some((v) => v.z0 <= z && z <= v.z1 && v.x0 <= 9 && v.y0 <= (column.y0 + column.y1) / 2 && (column.y0 + column.y1) / 2 <= v.y1)
        expect(hole(sideVoids)).not.toBe(hole(topVoids))
      }
      expect(new Set(sideVoids.map((v) => Math.round(v.z0))).size).toBe(Math.floor(n / 2))
    }
  })

  it('makes the sides as tall as the furniture and says how it is cut', () => {
    const { design, notes } = build(topFingers())
    expect(notes.some((m) => m.startsWith('Cubierta con dedos en 2 esquinas, 5 por esquina'))).toBe(true)
    expect(design.pieces.find((p) => p.id === 'side-left')!.cuts!.length).toBe(2)
  })
})
