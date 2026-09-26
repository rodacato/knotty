import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { startAt, partway, mm, makePiece, ref, extent, makeJoint } from '../design/builders'
import { differences } from '../design/diff'
import type { Design } from '../design/schema'
import { normalize } from '../design/normalize'
import { resolveGeometry } from '../design/resolve'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { cutList } from '../materials/cutList'
import { applyOperations } from './apply'
import { Operation } from './schema'

const applied = (d: Design, ops: Operation[]) => {
  const r = applyOperations(d, ops.map((o) => Operation.parse(o)), testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}
const boxesOf = (d: Design) => {
  const r = resolveGeometry(d, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value.boxes
}
const errorCodes = (d: Design) => {
  const a = analyze(d, testCatalog)
  return a.valid ? [] : a.errors.map((e) => e.code)
}

const divider = makePiece({
  id: 'divider',
  name: 'Divisor',
  role: 'divider',
  material: 'T18',
  normal: 'x',
  x: startAt(partway('side-left.x1', 'side-right.x0', 0.5, -9)),
  y: extent(ref('bottom.y1'), ref('top.y0')),
  z: extent(ref('back.z1'), ref('furniture.z1')),
})

describe('applyOperations', () => {
  it('stretching wider carries to the sides and shelves and leaves the rest alone', () => {
    const { design } = applied(exampleBookcase, [{ op: 'resizeFurniture', axis: 'x', value: 900, rule: 'stretch' }])
    expect(errorCodes(design)).toEqual([])
    const d = differences(exampleBookcase, boxesOf(exampleBookcase), design, boxesOf(design))
    expect(d.changed).toEqual(expect.arrayContaining(['side-right', 'bottom', 'top', 'kick', 'back', 'shelf-1']))
    expect(d.changed).not.toContain('side-left')
  })

  it('adding a divider requires splitting the shelves it crosses', () => {
    const { design } = applied(exampleBookcase, [{ op: 'addPiece', piece: divider }])
    expect(errorCodes(design)).toContain('E_OVERLAP')
  })

  it('a full divider: shelves split in two with joints, and it stays valid', () => {
    const ops: Operation[] = [{ op: 'resizeFurniture', axis: 'x', value: 900, rule: 'stretch' }, { op: 'addPiece', piece: divider }]
    ops.push(
      { op: 'addJoint', joint: makeJoint('j-div-bottom', 'bottom', 'divider', 'butt-screw') },
      { op: 'addJoint', joint: makeJoint('j-div-top', 'top', 'divider', 'butt-screw') },
    )
    for (let i = 1; i <= 4; i++) {
      const id = `shelf-${i}`
      ops.push(
        { op: 'resize', id, axis: 'x', end: 'to', at: ref('divider.x0') },
        { op: 'duplicatePiece', id, newId: `${id}-right`, name: `Entrepaño ${i} derecho`, axis: 'x', at: ref('divider.x1') },
        { op: 'resize', id: `${id}-right`, axis: 'x', end: 'to', at: ref('side-right.x0') },
        { op: 'removeJoint', id: `j-${id}-side-right` },
        { op: 'addJoint', joint: makeJoint(`j-${id}-div`, id, 'divider', 'shelf-pin') },
        { op: 'addJoint', joint: makeJoint(`j-${id}-right-div`, `${id}-right`, 'divider', 'shelf-pin') },
      )
    }
    const { design } = applied(exampleBookcase, ops)
    expect(errorCodes(design)).toEqual([])
    const a = analyze(design, testCatalog)
    if (!a.valid) throw new Error()
    expect(a.findings.filter((h) => h.code === 'R1_SAG').map((h) => h.pieces[0])).toEqual(['bottom'])
  })

  it('removing a piece freezes the positions that referred to it and warns', () => {
    const { design, warnings } = applied(exampleBookcase, [{ op: 'removePiece', id: 'kick' }])
    expect(design.pieces.find((p) => p.id === 'bottom')!.y.from).toEqual(mm(70))
    expect(design.joints.some((u) => u.a === 'kick' || u.b === 'kick')).toBe(false)
    expect(warnings[0].code).toBe('W_FROZEN_REFERENCE')
  })

  it('moving keeps the length and a lowered shelf stays valid', () => {
    const { design } = applied(exampleBookcase, [{ op: 'move', id: 'shelf-1', axis: 'y', at: mm(300) }])
    expect(boxesOf(design).get('shelf-1')).toMatchObject({ y0: 300, y1: 318 })
    expect(errorCodes(design)).toEqual([])
  })

  it('distributing spaces evenly', () => {
    const withFive = applied(exampleBookcase, [
      { op: 'duplicatePiece', id: 'shelf-4', newId: 'shelf-5', name: 'Entrepaño 5', axis: 'y', at: mm(1700) },
      { op: 'distribute', ids: ['shelf-1', 'shelf-2', 'shelf-3', 'shelf-4', 'shelf-5'], axis: 'y', a: 'bottom.y1', b: 'top.y0' },
    ]).design
    const c = boxesOf(withFive)
    const ys = ['bottom', 'shelf-1', 'shelf-2', 'shelf-3', 'shelf-4', 'shelf-5', 'top'].map((id) => c.get(id)!)
    const gaps = ys.slice(1).map((box, i) => box.y0 - ys[i].y1)
    for (const h of gaps) expect(h).toBeCloseTo(gaps[0], 5)
    expect(withFive.joints.filter((u) => u.a === 'shelf-5')).toHaveLength(2)
  })

  it('changing thickness carries to what refers to it', () => {
    const { design } = applied(exampleBookcase, [{ op: 'changeMaterial', ids: ['side-left', 'side-right'], material: 'T15' }])
    expect(boxesOf(design).get('bottom')).toMatchObject({ x0: 15, x1: 555 })
  })

  it('proportional scales the absolute positions', () => {
    const withMm = applied(exampleBookcase, [{ op: 'move', id: 'shelf-1', axis: 'y', at: mm(400) }]).design
    const { design } = applied(withMm, [{ op: 'resizeFurniture', axis: 'y', value: 900, rule: 'proportional' }])
    expect(boxesOf(design).get('shelf-1')!.y0).toBe(200)
  })

  it('fails without applying anything and names the operation', () => {
    const r = applyOperations(exampleBookcase, [{ op: 'setWallAnchored', value: false }, { op: 'removePiece', id: 'missing' }], testCatalog)
    expect(r.ok).toBe(false)
    expect(r.ok ? undefined : r.errors[0]).toMatchObject({ code: 'E_UNKNOWN_PIECE', data: { operation: 1 } })
    expect(exampleBookcase.wallAnchored).toBe(true)
  })

  it('does not resize along the thickness axis', () => {
    const r = applyOperations(exampleBookcase, [{ op: 'resize', id: 'bottom', axis: 'y', end: 'to', at: mm(200) }], testCatalog)
    expect(r.ok || r.errors[0].code).toBe('E_INVALID_OPERATION')
  })
})

describe('normalize', () => {
  it('ties absolute positions to nearby faces without moving them and makes the model parametric', () => {
    const flat = structuredClone(exampleBookcase)
    const current = boxesOf(exampleBookcase)
    for (const p of flat.pieces) {
      const c = current.get(p.id)!
      p.x = p.normal === 'x' ? startAt(mm(c.x0)) : extent(mm(c.x0), mm(c.x1))
      p.y = p.normal === 'y' ? startAt(mm(c.y0)) : extent(mm(c.y0), mm(c.y1))
      p.z = p.normal === 'z' ? startAt(mm(c.z0)) : extent(mm(c.z0), mm(c.z1))
    }
    const normal = normalize(flat, testCatalog)
    expect(boxesOf(normal)).toEqual(current)
    const wide = applied(normal, [{ op: 'resizeFurniture', axis: 'x', value: 900, rule: 'stretch' }]).design
    expect(errorCodes(wide)).toEqual([])
    expect(boxesOf(wide).get('shelf-3')).toMatchObject({ x0: 18, x1: 882 })
  })
})

describe('cutList', () => {
  it('groups equal pieces', () => {
    const r = resolveGeometry(exampleBookcase, testCatalog)
    if (!r.ok) throw new Error()
    const list = cutList(exampleBookcase, r.value)
    expect(list.find((l) => l.ids.includes('shelf-1'))).toMatchObject({ name: 'Entrepaño', count: 4, length: 534, width: 294, thickness: 18 })
    expect(list.find((l) => l.ids.includes('side-left'))).toMatchObject({ count: 2, length: 1800, width: 294 })
  })
})
