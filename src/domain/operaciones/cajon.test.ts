import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { desde, ref } from '../diseno/construir'
import type { Diseno } from '../diseno/esquema'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { estimarCompra } from '../materiales/compra'
import { aplicar } from './aplicar'
import type { Operacion } from './esquema'

const cajon = (extra: Partial<Extract<Operacion, { op: 'agregarCajon' }>> = {}): Operacion => ({
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

const hondo: Diseno = { ...librero, dimensiones: { ...librero.dimensiones, fondo: 500 } }

const conCajon = (base: Diseno, ops: Operacion[] = [cajon()]) => {
  const r = aplicar(base, ops, catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errores))
  return r.valor.diseno
}
const analisis = (d: Diseno) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(JSON.stringify(a.errores))
  return a
}

describe('agregarCajon', () => {
  it('arma seis piezas agrupadas, válidas y sin observaciones, con la corredera más larga que cabe', () => {
    const d = conCajon(hondo)
    const piezas = d.piezas.filter((p) => p.grupo === 'cajon-1')
    expect(piezas.map((p) => p.id).sort()).toEqual(['cajon-1-contra', 'cajon-1-costado-der', 'cajon-1-costado-izq', 'cajon-1-fondo', 'cajon-1-frente', 'cajon-1-trasera'])
    const a = analisis(d)
    expect(a.hallazgos).toEqual([])
    expect(d.uniones.find((u) => u.id === 'u-cajon-1-corredera-izq')?.herrajes[0].herrajeId).toBe('corredera-telescopica-45')
    const frente = a.geo.cajas.get('cajon-1-frente')!
    expect(frente.z1).toBe(500)
    expect(frente.x0).toBe(20)
    const costado = a.geo.cajas.get('cajon-1-costado-izq')!
    expect(costado.x0).toBeCloseTo(18 + 12.7, 5)
  })

  it('se ajusta solo si el mueble se ensancha', () => {
    const d = conCajon(hondo, [cajon(), { op: 'cambiarDimensionGlobal', eje: 'x', valor: 800, regla: 'estirar' }])
    const a = analisis(d)
    expect(a.geo.cajas.get('cajon-1-frente')).toMatchObject({ x0: 20, x1: 780 })
    expect(a.hallazgos.filter((h) => h.codigo === 'R9_CAJONES')).toEqual([])
  })

  it('entra en la compra: correderas y piezas del cajón', () => {
    const d = conCajon(hondo)
    const compra = estimarCompra(d, analisis(d).geo, catalogo)
    expect(compra.herrajes.find((h) => h.herraje.id === 'corredera-telescopica-45')?.cantidad).toBe(1)
    expect(compra.hojas.map((h) => h.material.id)).toContain('T15')
  })

  it('se quita completo con eliminarGrupo', () => {
    const d = conCajon(conCajon(hondo), [{ op: 'eliminarGrupo', grupo: 'cajon-1' }])
    expect(d.piezas.some((p) => p.grupo === 'cajon-1')).toBe(false)
    expect(d.uniones.some((u) => u.id.includes('cajon-1'))).toBe(false)
    expect(analizar(d, catalogo).valido).toBe(true)
  })

  it('no cabe en un mueble muy poco profundo', () => {
    const r = aplicar(librero, [cajon()], catalogo)
    expect(r.ok || r.errores[0]).toMatchObject({ codigo: 'E_OPERACION_INVALIDA', mensaje: expect.stringContaining('No cabe un cajón') })
  })
})

describe('R9 cajones y tornillos por la cara', () => {
  const hallazgos = (d: Diseno) => analisis(d).hallazgos

  it('una corredera sin su holgura exacta es crítica', () => {
    const d = conCajon(hondo)
    d.piezas.find((p) => p.id === 'cajon-1-costado-izq')!.x = desde(ref('lat-izq.x1', 8))
    const r9 = hallazgos(d).filter((h) => h.codigo === 'R9_CAJONES')
    expect(r9).toEqual([expect.objectContaining({ severidad: 'critico', mensaje: expect.stringContaining('no entra') })])
  })

  it('un fondo de 3 mm en un cajón ancho se vence', () => {
    const d = conCajon({ ...hondo, dimensiones: { ...hondo.dimensiones, ancho: 700 } }, [cajon({ materialFondo: 'TR3' })])
    expect(hallazgos(d).filter((h) => h.codigo === 'R9_CAJONES').map((h) => [h.severidad, h.piezas[0]])).toEqual([['recomendacion', 'cajon-1-fondo']])
  })

  it('un tornillo que entra por la cara no debe asomarse del otro lado', () => {
    const d = conCajon(hondo)
    d.uniones = d.uniones.map((u) => (u.id === 'u-cajon-1-contra-frente' ? { ...u, herrajes: [{ herrajeId: 'tornillo-8x2', cantidad: 4 }] } : u))
    expect(hallazgos(d).map((h) => [h.codigo, h.severidad, h.datos.union])).toEqual([['R3_TORNILLOS', 'critico', 'u-cajon-1-contra-frente']])
  })
})
