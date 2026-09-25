import type { Pieza, TipoUnion, Union } from '../../diseno/esquema'
import { roundTo } from '../../diseno/resolve'
import type { Catalogo } from '../../materiales/catalogo'
import type { Finding, Rule, Severity } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

// R2: each joint needs enough board on each side, and a groove or rabbet must not weaken what takes it.

const JOINT_NAME: Record<TipoUnion, string> = {
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

const thinnestBoard = (catalog: Catalogo, thickness: number) =>
  catalog.materiales.filter((m) => m.tipo === 'triplay' && m.espesor >= thickness).sort((a, b) => a.espesor - b.espesor)[0]

function tooThin(u: Union, piece: Pieza, thickness: number, minimum: number, severity: Severity, catalog: Catalogo): Finding {
  const suggested = thinnestBoard(catalog, minimum)
  return {
    code: 'R2_ESPESOR_UNION',
    severity,
    pieces: [u.a, u.b],
    message: `Una unión con ${JOINT_NAME[u.tipo]} necesita al menos ${minimum} mm en ${piece.nombre}, que es de ${thickness} mm.`,
    data: { union: u.id, tipo: u.tipo, pieza: piece.id, espesor: thickness, minimo: minimum },
    alternatives: suggested ? [{ key: 'subir-espesor', description: `Hacer ${piece.nombre} de ${suggested.nombre}`, data: { pieza: piece.id, material: suggested.id } }] : [],
  }
}

export const jointThicknessRule: Rule = ({ design, geo, catalog }) =>
  design.uniones.flatMap((u): Finding[] => {
    const a = design.piezas.find((p) => p.id === u.a)
    const b = design.piezas.find((p) => p.id === u.b)
    const ta = geo.thicknesses.get(u.a)
    const tb = geo.thicknesses.get(u.b)
    if (!a || !b || ta === undefined || tb === undefined) return []

    const thin = [[a, ta], [b, tb]].find(([, t]) => (t as number) <= ASSUMPTIONS.nailOnlyThickness) as [Pieza, number] | undefined
    if (thin && !['clavo-pegamento', 'canal', 'rebaje'].includes(u.tipo))
      return [
        {
          code: 'R2_ESPESOR_UNION',
          severity: 'recomendacion',
          pieces: [u.a, u.b],
          message: `${thin[0].nombre} es de ${thin[1]} mm: se fija con clavo y pegamento, o en canal o rebaje; el ${JOINT_NAME[u.tipo]} no agarra.`,
          data: { union: u.id, tipo: u.tipo, pieza: thin[0].id, espesor: thin[1] },
          alternatives: [{ key: 'cambiar-union', description: 'Clavo sin cabeza con pegamento', data: { tipo: 'clavo-pegamento' } }],
        },
      ]

    const minimums = ASSUMPTIONS.joints[u.tipo as keyof typeof ASSUMPTIONS.joints] as { a?: number; b?: number; bCritical?: number } | undefined
    if (!minimums) return []
    const found: Finding[] = []
    if (minimums.a !== undefined && ta < minimums.a) found.push(tooThin(u, a, ta, minimums.a, 'critico', catalog))
    if (minimums.b !== undefined && tb < minimums.b) {
      const severity = minimums.bCritical !== undefined && tb >= minimums.bCritical ? 'recomendacion' : 'critico'
      found.push(tooThin(u, b, tb, minimums.b, severity, catalog))
    }
    if ((u.tipo === 'canal' || u.tipo === 'rebaje') && u.penetracion !== null) {
      const fraction = u.penetracion / tb
      const severity: Severity | null = fraction > ASSUMPTIONS.penetration.critical ? 'critico' : fraction > ASSUMPTIONS.penetration.recommended ? 'recomendacion' : null
      if (severity)
        found.push({
          code: 'R2_ESPESOR_UNION',
          severity,
          pieces: [u.a, u.b],
          message: `El ${u.tipo} de ${u.penetracion} mm debilita ${b.nombre} (${tb} mm); lo recomendable es hasta ${roundTo(tb * ASSUMPTIONS.penetration.recommended)} mm.`,
          data: { union: u.id, tipo: u.tipo, pieza: b.id, espesor: tb, penetracion: u.penetracion },
          alternatives: [{ key: 'reducir-penetracion', description: `Hacer el ${u.tipo} de ${roundTo(tb * ASSUMPTIONS.penetration.recommended, 0)} mm`, data: { penetracion: roundTo(tb * ASSUMPTIONS.penetration.recommended, 0) } }],
        })
    }
    return found
  })
