import { describe, expect, it } from 'vitest'
import { analizar } from '../../analisis'
import { desde, hasta, pieza, ref, tramo, union } from '../../diseno/construir'
import type { Diseno } from '../../diseno/esquema'
import { catalogo } from '../../fixtures/catalogo.test-util'
import { librero } from '../../fixtures/librero'
import { completeJoints } from '../../diseno/joints'
import { fixesFor } from '../../fixes/fixes'
import { aplicar } from '../../operaciones/aplicar'
import type { Operacion } from '../../operaciones/esquema'

const drawer = (extra: Partial<Extract<Operacion, { op: 'agregarCajon' }>> = {}): Operacion => ({
  op: 'agregarCajon',
  grupo: 'cajon-1',
  nombre: 'Cajón 1',
  izquierda: 'lat-izq.x1',
  derecha: 'lat-der.x0',
  abajo: 'piso.y1',
  arriba: 'entrepano-1.y0',
  frente: 'mueble.z1',
  fondo: 'trasera.z1',
  material: 'T15',
  materialFondo: 'TR6',
  ...extra,
})
const deep: Diseno = { ...librero, dimensiones: { ...librero.dimensiones, fondo: 500 } }
const build = (base: Diseno, ops: Operacion[]) => {
  const r = aplicar(base, ops, catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errores))
  return r.valor.diseno
}
/** A drawer as a freeform design would have it: its pieces, but no runner joints. */
const freeform = (d: Diseno): Diseno => ({ ...d, uniones: d.uniones.filter((u) => u.tipo !== 'corredera') })
const r9 = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a.hallazgos.filter((h) => h.codigo === 'R9_CAJONES')
}

describe('R9 for freeform drawers', () => {
  it('reads the carcass sides as runner supports when they sit at the runner gap', () => {
    expect(r9(freeform(build(deep, [drawer()])))).toEqual([])
  })

  it('gets its runners from the pieces beside the box, one pair of hardware per drawer', () => {
    const runners = completeJoints(freeform(build(deep, [drawer()])), catalogo).uniones.filter((u) => u.tipo === 'corredera')
    expect(runners.map((u) => [u.a, u.b, u.herrajes.length])).toEqual([
      ['cajon-1-costado-izq', 'lat-izq', 1],
      ['cajon-1-costado-der', 'lat-der', 0],
    ])
  })

  it('a box side with nothing beside it has nowhere to screw the runner, and Knotty can put a piece there', () => {
    const d = freeform(build(deep, [drawer()]))
    // The box sits 100 mm in from the left side, with nothing beside it.
    d.piezas = d.piezas.map((p) =>
      p.id === 'cajon-1-costado-izq' ? { ...p, x: desde({ tipo: 'mm', mm: 120 }) } : p.id === 'cajon-1-fondo' ? { ...p, x: tramo(ref('cajon-1-costado-izq.x0'), ref('cajon-1-costado-der.x1')) } : p,
    )
    const [finding] = r9(d)
    expect(finding).toMatchObject({ severidad: 'critico', mensaje: expect.stringContaining('no tiene dónde atornillar la corredera') })
    const [fix] = fixesFor(d, catalogo, finding)
    expect(fix.key).toBe('apoyo-corredera')
    expect(r9(fix.design).filter((h) => h.severidad === 'critico')).toEqual([])
    expect(fix.design.uniones.some((u) => u.tipo === 'corredera' && u.a === 'cajon-1-costado-izq')).toBe(true)
  })

  it('a drawer that reaches the ground drags on it', () => {
    const low: Diseno = {
      esquema: 1,
      nombre: 'Cajonera baja',
      dimensiones: { ancho: 500, alto: 300, fondo: 450 },
      anclajeMuro: false,
      observaciones: '',
      piezas: [
        pieza({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: 'TR6', normal: 'z', x: tramo(ref('mueble.x0'), ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: desde(ref('mueble.z0')) }),
        pieza({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', material: 'T18', normal: 'x', x: desde(ref('mueble.x0')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')) }),
        pieza({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', material: 'T18', normal: 'x', x: hasta(ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')) }),
        pieza({ id: 'techo', nombre: 'Techo', rol: 'techo', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: hasta(ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')) }),
      ],
      uniones: [union('u-techo-izq', 'lat-izq', 'techo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]), union('u-techo-der', 'lat-der', 'techo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }])],
    }
    const d = build(low, [drawer({ abajo: 'mueble.y0', arriba: 'techo.y0' })])
    expect(r9(d).map((h) => h.mensaje)).toEqual([expect.stringContaining('llega al suelo')])
  })
})
