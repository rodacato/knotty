import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import type { Diseno } from './esquema'
import { completeJoints } from './joints'

const signature = (d: Diseno) => d.uniones.map((u) => `${u.a} → ${u.b} ${u.tipo}`).sort()
const criticals = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(a.errores[0].mensaje)
  return a.hallazgos.filter((h) => h.severidad === 'critico')
}

describe('completeJoints', () => {
  it('without joints, rebuilds the hand-made ones of the fixtures except the special ones', () => {
    expect(signature(completeJoints({ ...alacena, uniones: [] }, catalogo))).toEqual(signature(alacena))
    // The fixture kick plate uses pocket screws and the nightstand shelf uses dowels: the expert declares those.
    const withoutKick = signature(librero).filter((u) => !u.startsWith('zoclo → lat'))
    expect(signature(completeJoints({ ...librero, uniones: [] }, catalogo))).toEqual([...withoutKick, 'lat-der → zoclo tope-tornillo', 'lat-izq → zoclo tope-tornillo'].sort())
    const withoutDowels = signature(buro).filter((u) => !u.includes('tarugo'))
    expect(signature(completeJoints({ ...buro, uniones: [] }, catalogo))).toEqual([...withoutDowels, 'lat-der → entrepano tope-tornillo', 'lat-izq → entrepano tope-tornillo'].sort())
  })

  it.each([librero, buro, alacena])('what it infers passes the structural review without criticals: $nombre', (diseno) => {
    expect(criticals(completeJoints({ ...diseno, uniones: [] }, catalogo))).toEqual([])
  })

  it('keeps the joints the expert declared and picks a screw that bites 25 mm into the edge', () => {
    const pocket = librero.uniones.filter((u) => u.b === 'lat-izq' && u.a === 'zoclo')
    const d = completeJoints({ ...librero, uniones: pocket }, catalogo)
    expect(d.uniones.filter((u) => [u.a, u.b].sort().join() === 'lat-izq,zoclo')).toEqual(pocket)
    expect(d.uniones.find((u) => u.a === 'lat-izq' && u.b === 'piso')?.herrajes).toEqual([{ herrajeId: 'tornillo-8x2', cantidad: null }])
  })

  it('given the previous design, does not bring back a joint removed on purpose', () => {
    const withoutOne = { ...librero, uniones: librero.uniones.filter((u) => u.id !== 'u-trasera-techo') }
    expect(completeJoints(withoutOne, catalogo, librero).uniones).toHaveLength(withoutOne.uniones.length)
    expect(completeJoints(withoutOne, catalogo).uniones).toHaveLength(librero.uniones.length)
  })

  it('pieces the model grouped into parts still get their joints; only drawer parts are skipped', () => {
    const grouped = { ...librero, uniones: [], piezas: librero.piezas.map((p) => ({ ...p, grupo: 'casco' })) }
    expect(signature(completeJoints(grouped, catalogo))).toEqual(signature(completeJoints({ ...librero, uniones: [] }, catalogo)))
  })

  it('is deterministic', () => {
    const empty = { ...librero, uniones: [] }
    expect(completeJoints(empty, catalogo)).toEqual(completeJoints(structuredClone(empty), catalogo))
  })
})
