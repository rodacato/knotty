import { materialPorId, type Catalogo } from '../materiales/catalogo'
import { error, success, failure, type DesignError, type Result } from '../validation/errors'
import { DIMENSION_DE_EJE, EJES, type CaraRef, type Cota, type Diseno, type Eje, type Pieza, type Tramo } from './esquema'

export interface Caja {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
}

export interface Geometria {
  cajas: Map<string, Caja>
  espesores: Map<string, number>
  /** Valor absoluto de una cota en el diseño resuelto. */
  valor: (cota: Cota, eje: Eje) => number
}

const TOLERANCIA = 0.5

class FalloResolucion extends Error {
  constructor(readonly detalle: DesignError) {
    super(detalle.mensaje)
  }
}

export const ejesDeCara = (normal: Eje) => EJES.filter((e) => e !== normal) as [Eje, Eje]

export function parseCara(ref: CaraRef) {
  const [pieza, cara] = ref.split('.')
  return { pieza, eje: cara[0] as Eje, lado: Number(cara[1]) as 0 | 1 }
}

export const piezasReferidas = (tramo: Tramo) =>
  [tramo.desde, tramo.hasta].flatMap((c) => (!c ? [] : c.tipo === 'ref' ? [c.ref] : c.tipo === 'entre' ? [c.a, c.b] : [])).map((r) => parseCara(r).pieza)

export function resolver(diseno: Diseno, catalogo: Catalogo): Result<Geometria> {
  const porId = new Map(diseno.piezas.map((p) => [p.id, p]))
  const tramos = new Map<string, [number, number]>()
  const visitando: string[] = []

  const espesorDe = (p: Pieza) => {
    const material = materialPorId(catalogo, p.material)
    if (!material) throw new FalloResolucion(error('E_ESPESOR_CATALOGO', `"${p.id}" usa el material "${p.material}", que no está en el catálogo.`, { pieza: p.id, material: p.material }))
    return material.espesor
  }

  const cara = (ref: CaraRef, eje: Eje, quien: string): number => {
    const { pieza, eje: ejeRef, lado } = parseCara(ref)
    if (ejeRef !== eje) throw new FalloResolucion(error('E_REF_EJE', `"${quien}" usa "${ref}" en el eje ${eje}; una cota solo puede referir caras del mismo eje.`, { pieza: quien, ref, eje }))
    if (pieza === 'mueble') return lado === 0 ? 0 : diseno.dimensiones[DIMENSION_DE_EJE[eje]]
    const otra = porId.get(pieza)
    if (!otra) throw new FalloResolucion(error('E_REF_INEXISTENTE', `"${quien}" refiere "${ref}", pero no existe la pieza "${pieza}".`, { pieza: quien, ref }))
    return tramo(otra, eje)[lado]
  }

  const valor = (cota: Cota, eje: Eje, quien: string): number => {
    if (cota.tipo === 'mm') return cota.mm
    if (cota.tipo === 'ref') return cara(cota.ref, eje, quien) + cota.mas
    const a = cara(cota.a, eje, quien)
    return a + cota.t * (cara(cota.b, eje, quien) - a) + cota.mas
  }

  function tramo(p: Pieza, eje: Eje): [number, number] {
    const clave = `${p.id}.${eje}`
    const hecho = tramos.get(clave)
    if (hecho) return hecho
    if (visitando.includes(clave)) {
      const ciclo = [...visitando.slice(visitando.indexOf(clave)), clave]
      throw new FalloResolucion(error('E_CICLO', `Referencias circulares: ${ciclo.join(' → ')}.`, { ciclo }))
    }
    visitando.push(clave)
    try {
      const resultado = eje === p.normal ? tramoNormal(p, eje) : tramoCara(p, eje)
      if (resultado[1] - resultado[0] <= 0)
        throw new FalloResolucion(error('E_TRAMO_INVALIDO', `"${p.id}" queda con largo ${redondear(resultado[1] - resultado[0])} mm en el eje ${eje}.`, { pieza: p.id, eje, desde: resultado[0], hasta: resultado[1] }))
      tramos.set(clave, resultado)
      return resultado
    } finally {
      visitando.pop()
    }
  }

  function tramoNormal(p: Pieza, eje: Eje): [number, number] {
    const espesor = espesorDe(p)
    const { desde, hasta } = p[eje]
    if (desde) {
      const d = valor(desde, eje, p.id)
      if (hasta && Math.abs(valor(hasta, eje, p.id) - d - espesor) > TOLERANCIA)
        throw new FalloResolucion(error('E_TRAMO_INVALIDO', `En su eje normal (${eje}) "${p.id}" debe llevar solo desde o solo hasta; el largo es su espesor de ${espesor} mm.`, { pieza: p.id, eje }))
      return [d, d + espesor]
    }
    if (hasta) {
      const h = valor(hasta, eje, p.id)
      return [h - espesor, h]
    }
    throw new FalloResolucion(error('E_TRAMO_INVALIDO', `"${p.id}" no tiene posición en su eje normal (${eje}).`, { pieza: p.id, eje }))
  }

  function tramoCara(p: Pieza, eje: Eje): [number, number] {
    const { desde, hasta, largo } = p[eje]
    if (desde && hasta) {
      const d = valor(desde, eje, p.id)
      const h = valor(hasta, eje, p.id)
      if (largo !== null && Math.abs(h - d - largo) > TOLERANCIA)
        throw new FalloResolucion(error('E_TRAMO_INVALIDO', `"${p.id}" en ${eje}: desde, hasta y largo no coinciden (${redondear(h - d)} ≠ ${largo}).`, { pieza: p.id, eje }))
      return [d, h]
    }
    if (desde && largo !== null) {
      const d = valor(desde, eje, p.id)
      return [d, d + largo]
    }
    if (hasta && largo !== null) {
      const h = valor(hasta, eje, p.id)
      return [h - largo, h]
    }
    throw new FalloResolucion(error('E_TRAMO_INVALIDO', `"${p.id}" en ${eje} necesita dos de: desde, hasta, largo.`, { pieza: p.id, eje }))
  }

  const errores: DesignError[] = []
  const cajas = new Map<string, Caja>()
  const espesores = new Map<string, number>()
  const vistos = new Set<string>()
  for (const p of diseno.piezas) {
    if (vistos.has(p.id)) errores.push(error('E_ID_DUPLICADO', `Hay dos piezas con el id "${p.id}".`, { pieza: p.id }))
    vistos.add(p.id)
    const porEje = EJES.map((eje) => {
      try {
        return tramo(p, eje)
      } catch (e) {
        if (!(e instanceof FalloResolucion)) throw e
        if (!errores.some((otro) => otro.mensaje === e.detalle.mensaje)) errores.push(e.detalle)
        return null
      }
    })
    if (porEje.some((t) => !t)) continue
    const [[x0, x1], [y0, y1], [z0, z1]] = porEje as [number, number][]
    cajas.set(p.id, { x0, x1, y0, y1, z0, z1 })
    espesores.set(p.id, espesorDe(p))
  }
  if (errores.length) return failure(errores)
  return success({ cajas, espesores, valor: (cota, eje) => valor(cota, eje, 'consulta') })
}

export const redondear = (mm: number, decimales = 1) => Math.round(mm * 10 ** decimales) / 10 ** decimales

export const medidas = (caja: Caja) => ({ x: caja.x1 - caja.x0, y: caja.y1 - caja.y0, z: caja.z1 - caja.z0 })

/** Las dos medidas de la cara, de mayor a menor. */
export function medidasCara(caja: Caja, normal: Eje): [number, number] {
  const m = medidas(caja)
  const [a, b] = ejesDeCara(normal).map((e) => m[e])
  return a >= b ? [a, b] : [b, a]
}
