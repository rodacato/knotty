import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { startAt, partway, mm, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import { differences } from '../diseno/diff'
import type { Design } from '../diseno/schema'
import { normalize } from '../diseno/normalize'
import { resolveGeometry } from '../diseno/resolve'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { cutList } from '../materiales/cutList'
import { applyOperations } from './apply'
import { Operation } from './schema'

const aplicado = (d: Design, ops: Operation[]) => {
  const r = applyOperations(d, ops.map((o) => Operation.parse(o)), testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}
const cajas = (d: Design) => {
  const r = resolveGeometry(d, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value.boxes
}
const valido = (d: Design) => {
  const a = analyze(d, testCatalog)
  return a.valid ? [] : a.errors.map((e) => e.code)
}

const divisor = makePiece({
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
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'resizeFurniture', axis: 'x', value: 900, rule: 'stretch' }])
    expect(valido(diseno)).toEqual([])
    const d = differences(exampleBookcase, cajas(exampleBookcase), diseno, cajas(diseno))
    expect(d.changed).toEqual(expect.arrayContaining(['side-right', 'bottom', 'top', 'kick', 'back', 'shelf-1']))
    expect(d.changed).not.toContain('side-left')
  })

  it('adding a divider requires splitting the shelves it crosses', () => {
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'addPiece', piece: divisor }])
    expect(valido(diseno)).toContain('E_OVERLAP')
  })

  it('a full divider: shelves split in two with joints, and it stays valid', () => {
    const ops: Operation[] = [{ op: 'resizeFurniture', axis: 'x', value: 900, rule: 'stretch' }, { op: 'addPiece', piece: divisor }]
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
    const { design: diseno } = aplicado(exampleBookcase, ops)
    expect(valido(diseno)).toEqual([])
    const a = analyze(diseno, testCatalog)
    if (!a.valid) throw new Error()
    expect(a.findings.filter((h) => h.code === 'R1_SAG').map((h) => h.pieces[0])).toEqual(['bottom'])
  })

  it('removing a piece freezes the cotas that referred to it and warns', () => {
    const { design: diseno, warnings: avisos } = aplicado(exampleBookcase, [{ op: 'removePiece', id: 'kick' }])
    expect(diseno.pieces.find((p) => p.id === 'bottom')!.y.from).toEqual(mm(70))
    expect(diseno.joints.some((u) => u.a === 'kick' || u.b === 'kick')).toBe(false)
    expect(avisos[0].code).toBe('W_FROZEN_REFERENCE')
  })

  it('moving keeps the length and a lowered shelf stays valid', () => {
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'move', id: 'shelf-1', axis: 'y', at: mm(300) }])
    expect(cajas(diseno).get('shelf-1')).toMatchObject({ y0: 300, y1: 318 })
    expect(valido(diseno)).toEqual([])
  })

  it('distributing spaces evenly', () => {
    const conCinco = aplicado(exampleBookcase, [
      { op: 'duplicatePiece', id: 'shelf-4', newId: 'shelf-5', name: 'Entrepaño 5', axis: 'y', at: mm(1700) },
      { op: 'distribute', ids: ['shelf-1', 'shelf-2', 'shelf-3', 'shelf-4', 'shelf-5'], axis: 'y', a: 'bottom.y1', b: 'top.y0' },
    ]).design
    const c = cajas(conCinco)
    const ys = ['bottom', 'shelf-1', 'shelf-2', 'shelf-3', 'shelf-4', 'shelf-5', 'top'].map((id) => c.get(id)!)
    const huecos = ys.slice(1).map((caja, i) => caja.y0 - ys[i].y1)
    for (const h of huecos) expect(h).toBeCloseTo(huecos[0], 5)
    expect(conCinco.joints.filter((u) => u.a === 'shelf-5')).toHaveLength(2)
  })

  it('changing thickness carries to what refers to it', () => {
    const { design: diseno } = aplicado(exampleBookcase, [{ op: 'changeMaterial', ids: ['side-left', 'side-right'], material: 'T15' }])
    expect(cajas(diseno).get('bottom')).toMatchObject({ x0: 15, x1: 585 })
  })

  it('proportional scales the absolute cotas', () => {
    const conMm = aplicado(exampleBookcase, [{ op: 'move', id: 'shelf-1', axis: 'y', at: mm(400) }]).design
    const { design: diseno } = aplicado(conMm, [{ op: 'resizeFurniture', axis: 'y', value: 900, rule: 'proportional' }])
    expect(cajas(diseno).get('shelf-1')!.y0).toBe(200)
  })

  it('fails without applying anything and names the operation', () => {
    const r = applyOperations(exampleBookcase, [{ op: 'setWallAnchored', value: false }, { op: 'removePiece', id: 'missing' }], testCatalog)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatchObject({ code: 'E_UNKNOWN_PIECE', data: { operation: 1 } })
    expect(exampleBookcase.wallAnchored).toBe(true)
  })

  it('does not resize along the thickness axis', () => {
    const r = applyOperations(exampleBookcase, [{ op: 'resize', id: 'bottom', axis: 'y', end: 'to', at: mm(200) }], testCatalog)
    expect(r.ok || r.errors[0].code).toBe('E_INVALID_OPERATION')
  })
})

describe('normalize', () => {
  it('ties absolute cotas to nearby faces without moving them and makes the model parametric', () => {
    const plano = structuredClone(exampleBookcase)
    const actuales = cajas(exampleBookcase)
    for (const p of plano.pieces) {
      const c = actuales.get(p.id)!
      p.x = p.normal === 'x' ? startAt(mm(c.x0)) : extent(mm(c.x0), mm(c.x1))
      p.y = p.normal === 'y' ? startAt(mm(c.y0)) : extent(mm(c.y0), mm(c.y1))
      p.z = p.normal === 'z' ? startAt(mm(c.z0)) : extent(mm(c.z0), mm(c.z1))
    }
    const normal = normalize(plano, testCatalog)
    expect(cajas(normal)).toEqual(actuales)
    const ancho = aplicado(normal, [{ op: 'resizeFurniture', axis: 'x', value: 900, rule: 'stretch' }]).design
    expect(valido(ancho)).toEqual([])
    expect(cajas(ancho).get('shelf-3')).toMatchObject({ x0: 18, x1: 882 })
  })
})

describe('cutList', () => {
  it('groups equal pieces', () => {
    const r = resolveGeometry(exampleBookcase, testCatalog)
    if (!r.ok) throw new Error()
    const lista = cutList(exampleBookcase, r.value)
    expect(lista.find((l) => l.ids.includes('shelf-1'))).toMatchObject({ name: 'Entrepaño', count: 4, length: 564, width: 294, thickness: 18 })
    expect(lista.find((l) => l.ids.includes('side-left'))).toMatchObject({ count: 2, length: 1800, width: 294 })
  })
})
