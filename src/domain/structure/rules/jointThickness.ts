import type { Pieza, TipoUnion, Union } from '../../diseno/esquema'
import { roundTo } from '../../diseno/resolve'
import type { Catalogo } from '../../materiales/catalogo'
import type { Finding, Rule, Severity } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

const NOMBRE_UNION: Record<TipoUnion, string> = {
  'tope-tornillo': 'tornillo al canto',
  bolsillo: 'tornillo de bolsillo',
  tarugo: 'tarugo',
  minifix: 'minifix',
  canal: 'canal',
  rebaje: 'rebaje',
  escuadra: 'escuadra',
  'clavo-pegamento': 'clavo y pegamento',
  'soporte-repisa': 'soporte de repisa',
  'bisagra-cazoleta': 'bisagra de cazoleta',
  corredera: 'corredera',
}

const materialMinimo = (catalogo: Catalogo, espesor: number) =>
  catalogo.materiales.filter((m) => m.tipo === 'triplay' && m.espesor >= espesor).sort((a, b) => a.espesor - b.espesor)[0]

function hallazgo(u: Union, pieza: Pieza, espesor: number, minimo: number, severidad: Severity, catalogo: Catalogo): Finding {
  const sugerido = materialMinimo(catalogo, minimo)
  return {
    code: 'R2_ESPESOR_UNION',
    severity: severidad,
    pieces: [u.a, u.b],
    message: `Una unión con ${NOMBRE_UNION[u.tipo]} necesita al menos ${minimo} mm en ${pieza.nombre}, que es de ${espesor} mm.`,
    data: { union: u.id, tipo: u.tipo, pieza: pieza.id, espesor, minimo },
    alternatives: sugerido ? [{ key: 'subir-espesor', description: `Hacer ${pieza.nombre} de ${sugerido.nombre}`, data: { pieza: pieza.id, material: sugerido.id } }] : [],
  }
}

export const jointThicknessRule: Rule = ({ design: diseno, geo, catalog: catalogo }) =>
  diseno.uniones.flatMap((u): Finding[] => {
    const a = diseno.piezas.find((p) => p.id === u.a)
    const b = diseno.piezas.find((p) => p.id === u.b)
    const ta = geo.thicknesses.get(u.a)
    const tb = geo.thicknesses.get(u.b)
    if (!a || !b || ta === undefined || tb === undefined) return []

    const delgada = [[a, ta], [b, tb]].find(([, t]) => (t as number) <= ASSUMPTIONS.nailOnlyThickness) as [Pieza, number] | undefined
    if (delgada && !['clavo-pegamento', 'canal', 'rebaje'].includes(u.tipo))
      return [
        {
          code: 'R2_ESPESOR_UNION',
          severity: 'recomendacion',
          pieces: [u.a, u.b],
          message: `${delgada[0].nombre} es de ${delgada[1]} mm: se fija con clavo y pegamento, o en canal o rebaje; el ${NOMBRE_UNION[u.tipo]} no agarra.`,
          data: { union: u.id, tipo: u.tipo, pieza: delgada[0].id, espesor: delgada[1] },
          alternatives: [{ key: 'cambiar-union', description: 'Clavo sin cabeza con pegamento', data: { tipo: 'clavo-pegamento' } }],
        },
      ]

    const minimos = ASSUMPTIONS.joints[u.tipo as keyof typeof ASSUMPTIONS.joints] as { a?: number; b?: number; bCritical?: number } | undefined
    if (!minimos) return []
    const encontrados: Finding[] = []
    if (minimos.a !== undefined && ta < minimos.a) encontrados.push(hallazgo(u, a, ta, minimos.a, 'critico', catalogo))
    if (minimos.b !== undefined && tb < minimos.b) {
      const severidad = minimos.bCritical !== undefined && tb >= minimos.bCritical ? 'recomendacion' : 'critico'
      encontrados.push(hallazgo(u, b, tb, minimos.b, severidad, catalogo))
    }
    if ((u.tipo === 'canal' || u.tipo === 'rebaje') && u.penetracion !== null) {
      const fraccion = u.penetracion / tb
      const severidad: Severity | null = fraccion > ASSUMPTIONS.penetration.critical ? 'critico' : fraccion > ASSUMPTIONS.penetration.recommended ? 'recomendacion' : null
      if (severidad)
        encontrados.push({
          code: 'R2_ESPESOR_UNION',
          severity: severidad,
          pieces: [u.a, u.b],
          message: `El ${u.tipo} de ${u.penetracion} mm debilita ${b.nombre} (${tb} mm); lo recomendable es hasta ${roundTo(tb * ASSUMPTIONS.penetration.recommended)} mm.`,
          data: { union: u.id, tipo: u.tipo, pieza: b.id, espesor: tb, penetracion: u.penetracion },
          alternatives: [{ key: 'reducir-penetracion', description: `Hacer el ${u.tipo} de ${roundTo(tb * ASSUMPTIONS.penetration.recommended, 0)} mm`, data: { penetracion: roundTo(tb * ASSUMPTIONS.penetration.recommended, 0) } }],
        })
    }
    return encontrados
  })
