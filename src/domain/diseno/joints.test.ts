import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { exampleWallCabinet } from '../fixtures/wallCabinet'
import { exampleNightstand } from '../fixtures/nightstand'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import type { Design } from './schema'
import { completeJoints } from './joints'

const signature = (d: Design) => d.uniones.map((u) => `${u.a} → ${u.b} ${u.tipo}`).sort()
const criticals = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(a.errors[0].message)
  return a.findings.filter((h) => h.severity === 'critico')
}

describe('completeJoints', () => {
  it('without joints, rebuilds the hand-made ones of the fixtures except the special ones', () => {
    expect(signature(completeJoints({ ...exampleWallCabinet, uniones: [] }, testCatalog))).toEqual(signature(exampleWallCabinet))
    // The fixture kick plate uses pocket screws and the nightstand shelf uses dowels: the expert declares those.
    const withoutKick = signature(exampleBookcase).filter((u) => !u.startsWith('zoclo → lat'))
    expect(signature(completeJoints({ ...exampleBookcase, uniones: [] }, testCatalog))).toEqual([...withoutKick, 'lat-der → zoclo tope-tornillo', 'lat-izq → zoclo tope-tornillo'].sort())
    const withoutDowels = signature(exampleNightstand).filter((u) => !u.includes('tarugo'))
    expect(signature(completeJoints({ ...exampleNightstand, uniones: [] }, testCatalog))).toEqual([...withoutDowels, 'lat-der → entrepano tope-tornillo', 'lat-izq → entrepano tope-tornillo'].sort())
  })

  it.each([exampleBookcase, exampleNightstand, exampleWallCabinet])('what it infers passes the structural review without criticals: $nombre', (diseno) => {
    expect(criticals(completeJoints({ ...diseno, uniones: [] }, testCatalog))).toEqual([])
  })

  it('keeps the joints the expert declared and picks a screw that bites 25 mm into the edge', () => {
    const pocket = exampleBookcase.uniones.filter((u) => u.b === 'lat-izq' && u.a === 'zoclo')
    const d = completeJoints({ ...exampleBookcase, uniones: pocket }, testCatalog)
    expect(d.uniones.filter((u) => [u.a, u.b].sort().join() === 'lat-izq,zoclo')).toEqual(pocket)
    expect(d.uniones.find((u) => u.a === 'lat-izq' && u.b === 'piso')?.herrajes).toEqual([{ herrajeId: 'tornillo-8x2', cantidad: null }])
  })

  it('given the previous design, does not bring back a joint removed on purpose', () => {
    const withoutOne = { ...exampleBookcase, uniones: exampleBookcase.uniones.filter((u) => u.id !== 'u-trasera-techo') }
    expect(completeJoints(withoutOne, testCatalog, exampleBookcase).uniones).toHaveLength(withoutOne.uniones.length)
    expect(completeJoints(withoutOne, testCatalog).uniones).toHaveLength(exampleBookcase.uniones.length)
  })

  it('pieces the model grouped into parts still get their joints; only drawer parts are skipped', () => {
    const grouped = { ...exampleBookcase, uniones: [], piezas: exampleBookcase.piezas.map((p) => ({ ...p, grupo: 'casco' })) }
    expect(signature(completeJoints(grouped, testCatalog))).toEqual(signature(completeJoints({ ...exampleBookcase, uniones: [] }, testCatalog)))
  })

  it('is deterministic', () => {
    const empty = { ...exampleBookcase, uniones: [] }
    expect(completeJoints(empty, testCatalog)).toEqual(completeJoints(structuredClone(empty), testCatalog))
  })
})
