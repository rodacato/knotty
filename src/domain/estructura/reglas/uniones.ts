import type { Pieza, TipoUnion, Union } from '../../diseno/esquema'
import { roundTo } from '../../diseno/resolve'
import type { Catalogo } from '../../materiales/catalogo'
import type { Hallazgo, Regla, Severidad } from '../hallazgo'
import { SUPUESTOS } from '../supuestos'

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

function hallazgo(u: Union, pieza: Pieza, espesor: number, minimo: number, severidad: Severidad, catalogo: Catalogo): Hallazgo {
  const sugerido = materialMinimo(catalogo, minimo)
  return {
    codigo: 'R2_ESPESOR_UNION',
    severidad,
    piezas: [u.a, u.b],
    mensaje: `Una unión con ${NOMBRE_UNION[u.tipo]} necesita al menos ${minimo} mm en ${pieza.nombre}, que es de ${espesor} mm.`,
    datos: { union: u.id, tipo: u.tipo, pieza: pieza.id, espesor, minimo },
    alternativas: sugerido ? [{ clave: 'subir-espesor', descripcion: `Hacer ${pieza.nombre} de ${sugerido.nombre}`, datos: { pieza: pieza.id, material: sugerido.id } }] : [],
  }
}

export const reglaEspesorUnion: Regla = ({ diseno, geo, catalogo }) =>
  diseno.uniones.flatMap((u): Hallazgo[] => {
    const a = diseno.piezas.find((p) => p.id === u.a)
    const b = diseno.piezas.find((p) => p.id === u.b)
    const ta = geo.thicknesses.get(u.a)
    const tb = geo.thicknesses.get(u.b)
    if (!a || !b || ta === undefined || tb === undefined) return []

    const delgada = [[a, ta], [b, tb]].find(([, t]) => (t as number) <= SUPUESTOS.espesorDeClavar) as [Pieza, number] | undefined
    if (delgada && !['clavo-pegamento', 'canal', 'rebaje'].includes(u.tipo))
      return [
        {
          codigo: 'R2_ESPESOR_UNION',
          severidad: 'recomendacion',
          piezas: [u.a, u.b],
          mensaje: `${delgada[0].nombre} es de ${delgada[1]} mm: se fija con clavo y pegamento, o en canal o rebaje; el ${NOMBRE_UNION[u.tipo]} no agarra.`,
          datos: { union: u.id, tipo: u.tipo, pieza: delgada[0].id, espesor: delgada[1] },
          alternativas: [{ clave: 'cambiar-union', descripcion: 'Clavo sin cabeza con pegamento', datos: { tipo: 'clavo-pegamento' } }],
        },
      ]

    const minimos = SUPUESTOS.uniones[u.tipo as keyof typeof SUPUESTOS.uniones] as { a?: number; b?: number; bCritico?: number } | undefined
    if (!minimos) return []
    const encontrados: Hallazgo[] = []
    if (minimos.a !== undefined && ta < minimos.a) encontrados.push(hallazgo(u, a, ta, minimos.a, 'critico', catalogo))
    if (minimos.b !== undefined && tb < minimos.b) {
      const severidad = minimos.bCritico !== undefined && tb >= minimos.bCritico ? 'recomendacion' : 'critico'
      encontrados.push(hallazgo(u, b, tb, minimos.b, severidad, catalogo))
    }
    if ((u.tipo === 'canal' || u.tipo === 'rebaje') && u.penetracion !== null) {
      const fraccion = u.penetracion / tb
      const severidad: Severidad | null = fraccion > SUPUESTOS.penetracion.critico ? 'critico' : fraccion > SUPUESTOS.penetracion.recomendacion ? 'recomendacion' : null
      if (severidad)
        encontrados.push({
          codigo: 'R2_ESPESOR_UNION',
          severidad,
          piezas: [u.a, u.b],
          mensaje: `El ${u.tipo} de ${u.penetracion} mm debilita ${b.nombre} (${tb} mm); lo recomendable es hasta ${roundTo(tb * SUPUESTOS.penetracion.recomendacion)} mm.`,
          datos: { union: u.id, tipo: u.tipo, pieza: b.id, espesor: tb, penetracion: u.penetracion },
          alternativas: [{ clave: 'reducir-penetracion', descripcion: `Hacer el ${u.tipo} de ${roundTo(tb * SUPUESTOS.penetracion.recomendacion, 0)} mm`, datos: { penetracion: roundTo(tb * SUPUESTOS.penetracion.recomendacion, 0) } }],
        })
    }
    return encontrados
  })
