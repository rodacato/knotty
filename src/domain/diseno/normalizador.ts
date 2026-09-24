import type { Catalogo } from '../materiales/catalogo'
import { DIMENSION_DE_EJE, EJES, type CaraRef, type Diseno, type Eje, type Pieza } from './esquema'
import { piezasReferidas, redondear, resolver, type Caja } from './resolver'

const IMAN = 3

type Extremo = 'desde' | 'hasta'
interface Candidata {
  ref: CaraRef
  valor: number
  preferencia: number
}

/** Ancla las cotas absolutas a la cara más cercana (sin moverlas) para que un modelo pensado en coordenadas se vuelva paramétrico. */
export function normalizar(original: Diseno, catalogo: Catalogo): Diseno {
  const r = resolver(original, catalogo)
  if (!r.ok) return original
  const { cajas } = r.valor
  const diseno = structuredClone(original)
  const porId = new Map(diseno.piezas.map((p) => [p.id, p]))

  const dependeDe = (desde: string, objetivo: string, eje: Eje, vistos = new Set<string>()): boolean => {
    if (desde === objetivo) return true
    if (vistos.has(desde)) return false
    vistos.add(desde)
    const p = porId.get(desde)
    return !!p && piezasReferidas(p[eje]).some((otra) => otra !== 'mueble' && dependeDe(otra, objetivo, eje, vistos))
  }

  const candidatas = (p: Pieza, eje: Eje, extremo: Extremo, soloMueble: boolean): Candidata[] => {
    const contraria = extremo === 'desde' ? 1 : 0
    const delMueble: Candidata[] = [
      { ref: `mueble.${eje}0`, valor: 0, preferencia: 0 },
      { ref: `mueble.${eje}1`, valor: diseno.dimensiones[DIMENSION_DE_EJE[eje]], preferencia: 0 },
    ]
    if (soloMueble) return delMueble
    return [
      ...delMueble,
      ...[...cajas]
        .filter(([id]) => id !== p.id && !dependeDe(id, p.id, eje))
        .flatMap(([id, caja]) => ([0, 1] as const).map((lado) => ({ ref: `${id}.${eje}${lado}` as CaraRef, valor: caja[`${eje}${lado}`], preferencia: lado === contraria ? 1 : 2 }))),
    ]
  }

  const mejor = (valor: number, lista: Candidata[]) =>
    lista
      .map((c) => ({ ...c, distancia: Math.abs(valor - c.valor) }))
      .filter((c) => c.distancia <= IMAN)
      .sort((a, b) => a.distancia - b.distancia || a.preferencia - b.preferencia)[0]

  const anclar = (p: Pieza, eje: Eje, caja: Caja, soloMueble: boolean) => {
    const t = p[eje]
    if (eje === p.normal) {
      const actual = t.desde ?? t.hasta
      if (actual?.tipo !== 'mm') return
      const opciones = (['desde', 'hasta'] as const)
        .map((extremo) => {
          const valor = extremo === 'desde' ? caja[`${eje}0`] : caja[`${eje}1`]
          const c = mejor(valor, candidatas(p, eje, extremo, soloMueble))
          return c && { extremo, valor, c }
        })
        .filter((o) => !!o)
        .sort((a, b) => a.c.distancia - b.c.distancia || a.c.preferencia - b.c.preferencia)
      const elegida = opciones[0]
      if (!elegida) return
      const cota = { tipo: 'ref' as const, ref: elegida.c.ref, mas: redondear(elegida.valor - elegida.c.valor) }
      p[eje] = { desde: elegida.extremo === 'desde' ? cota : null, hasta: elegida.extremo === 'hasta' ? cota : null, largo: null }
      return
    }
    for (const extremo of ['desde', 'hasta'] as const) {
      const cota = t[extremo]
      if (cota?.tipo !== 'mm') continue
      const c = mejor(cota.mm, candidatas(p, eje, extremo, soloMueble))
      if (c) t[extremo] = { tipo: 'ref', ref: c.ref, mas: redondear(cota.mm - c.valor) }
    }
  }

  for (const soloMueble of [true, false])
    for (const p of diseno.piezas)
      for (const eje of EJES) anclar(p, eje, cajas.get(p.id)!, soloMueble)
  return diseno
}
