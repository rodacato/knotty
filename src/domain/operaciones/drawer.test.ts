import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { startAt, ref } from '../diseno/builders'
import type { Design } from '../diseno/schema'
import { testCatalog } from '../fixtures/catalog.test-util'
import { exampleBookcase } from '../fixtures/bookcase'
import { estimatePurchase } from '../materiales/purchase'
import { applyOperations } from './apply'
import type { Operation } from './schema'

const cajon = (extra: Partial<Extract<Operation, { op: 'agregarCajon' }>> = {}): Operation => ({
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

const hondo: Design = { ...exampleBookcase, dimensiones: { ...exampleBookcase.dimensiones, fondo: 500 } }

const conCajon = (base: Design, ops: Operation[] = [cajon()]) => {
  const r = applyOperations(base, ops, testCatalog)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value.design
}
const analisis = (d: Design) => {
  const a = analyze(d, testCatalog)
  if (!a.valid) throw new Error(JSON.stringify(a.errors))
  return a
}

describe('agregarCajon', () => {
  it('builds six grouped pieces, valid and with nothing to report, with the longest runner that fits', () => {
    const d = conCajon(hondo)
    const piezas = d.piezas.filter((p) => p.grupo === 'cajon-1')
    expect(piezas.map((p) => p.id).sort()).toEqual(['cajon-1-contra', 'cajon-1-costado-der', 'cajon-1-costado-izq', 'cajon-1-fondo', 'cajon-1-frente', 'cajon-1-trasera'])
    const a = analisis(d)
    expect(a.findings).toEqual([])
    expect(d.uniones.find((u) => u.id === 'u-cajon-1-corredera-izq')?.herrajes[0].herrajeId).toBe('corredera-telescopica-45')
    const frente = a.geo.boxes.get('cajon-1-frente')!
    expect(frente.z1).toBe(500)
    expect(frente.x0).toBe(20)
    const costado = a.geo.boxes.get('cajon-1-costado-izq')!
    expect(costado.x0).toBeCloseTo(18 + 12.7, 5)
  })

  it('follows by itself when the furniture gets wider', () => {
    const d = conCajon(hondo, [cajon(), { op: 'cambiarDimensionGlobal', eje: 'x', valor: 800, regla: 'estirar' }])
    const a = analisis(d)
    expect(a.geo.boxes.get('cajon-1-frente')).toMatchObject({ x0: 20, x1: 780 })
    expect(a.findings.filter((h) => h.code === 'R9_CAJONES')).toEqual([])
  })

  it('goes into the purchase: runners and drawer pieces', () => {
    const d = conCajon(hondo)
    const compra = estimatePurchase(d, analisis(d).geo, testCatalog)
    expect(compra.hardware.find((h) => h.hardware.id === 'corredera-telescopica-45')?.count).toBe(1)
    expect(compra.sheets.map((h) => h.material.id)).toContain('T15')
  })

  it('comes out whole with eliminarGrupo', () => {
    const d = conCajon(conCajon(hondo), [{ op: 'eliminarGrupo', grupo: 'cajon-1' }])
    expect(d.piezas.some((p) => p.grupo === 'cajon-1')).toBe(false)
    expect(d.uniones.some((u) => u.id.includes('cajon-1'))).toBe(false)
    expect(analyze(d, testCatalog).valid).toBe(true)
  })

  it('does not fit in a very shallow piece', () => {
    const r = applyOperations(exampleBookcase, [cajon()], testCatalog)
    expect(r.ok || r.errors[0]).toMatchObject({ code: 'E_OPERACION_INVALIDA', message: expect.stringContaining('No cabe un cajón') })
  })
})

describe('R9 drawers and screws into a face', () => {
  const hallazgos = (d: Design) => analisis(d).findings

  it('a runner without its exact gap is critical', () => {
    const d = conCajon(hondo)
    d.piezas.find((p) => p.id === 'cajon-1-costado-izq')!.x = startAt(ref('lat-izq.x1', 8))
    const r9 = hallazgos(d).filter((h) => h.code === 'R9_CAJONES')
    expect(r9).toEqual([expect.objectContaining({ severity: 'critico', message: expect.stringContaining('no entra') })])
  })

  it('a 3 mm bottom in a wide drawer sags', () => {
    const d = conCajon({ ...hondo, dimensiones: { ...hondo.dimensiones, ancho: 700 } }, [cajon({ materialFondo: 'TR3' })])
    expect(hallazgos(d).filter((h) => h.code === 'R9_CAJONES').map((h) => [h.severity, h.pieces[0]])).toEqual([['recomendacion', 'cajon-1-fondo']])
  })

  it('a screw into a face must not come out the other side', () => {
    const d = conCajon(hondo)
    d.uniones = d.uniones.map((u) => (u.id === 'u-cajon-1-contra-frente' ? { ...u, herrajes: [{ herrajeId: 'tornillo-8x2', cantidad: 4 }] } : u))
    expect(hallazgos(d).map((h) => [h.code, h.severity, h.data.union])).toEqual([['R3_TORNILLOS', 'critico', 'u-cajon-1-contra-frente']])
  })
})
