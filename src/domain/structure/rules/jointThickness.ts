import type { Piece, JointType, Joint } from '../../diseno/schema'
import { roundTo } from '../../diseno/resolve'
import type { Catalog } from '../../materiales/catalog'
import type { Finding, Rule, Severity } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

// R2: each joint needs enough board on each side, and a groove or rabbet must not weaken what takes it.

const JOINT_NAME: Record<JointType, string> = {
  'butt-screw': 'tornillo al canto',
  'pocket-screw': 'tornillo de bolsillo',
  dowel: 'tarugo',
  'cam-lock': 'minifix',
  dado: 'canal',
  rabbet: 'rebaje',
  bracket: 'escuadra',
  'glue-nail': 'clavo y pegamento',
  'shelf-pin': 'soporte de repisa',
  'cup-hinge': 'bisagra de cazoleta',
  'drawer-slide': 'corredera',
}

const thinnestBoard = (catalog: Catalog, thickness: number) =>
  catalog.materials.filter((m) => m.type === 'plywood' && m.thickness >= thickness).sort((a, b) => a.thickness - b.thickness)[0]

function tooThin(u: Joint, piece: Piece, thickness: number, minimum: number, severity: Severity, catalog: Catalog): Finding {
  const suggested = thinnestBoard(catalog, minimum)
  return {
    code: 'R2_JOINT_THICKNESS',
    severity,
    pieces: [u.a, u.b],
    message: `Una unión con ${JOINT_NAME[u.type]} necesita al menos ${minimum} mm en ${piece.name}, que es de ${thickness} mm.`,
    data: { joint: u.id, type: u.type, piece: piece.id, thickness: thickness, min: minimum },
    alternatives: suggested ? [{ key: 'thicker-board', description: `Hacer ${piece.name} de ${suggested.name}`, data: { piece: piece.id, material: suggested.id } }] : [],
  }
}

export const jointThicknessRule: Rule = ({ design, geo, catalog }) =>
  design.joints.flatMap((u): Finding[] => {
    const a = design.pieces.find((p) => p.id === u.a)
    const b = design.pieces.find((p) => p.id === u.b)
    const ta = geo.thicknesses.get(u.a)
    const tb = geo.thicknesses.get(u.b)
    if (!a || !b || ta === undefined || tb === undefined) return []

    const thin = [[a, ta], [b, tb]].find(([, t]) => (t as number) <= ASSUMPTIONS.nailOnlyThickness) as [Piece, number] | undefined
    if (thin && !['glue-nail', 'dado', 'rabbet'].includes(u.type))
      return [
        {
          code: 'R2_JOINT_THICKNESS',
          severity: 'recommendation',
          pieces: [u.a, u.b],
          message: `${thin[0].name} es de ${thin[1]} mm: se fija con clavo y pegamento, o en canal o rebaje; el ${JOINT_NAME[u.type]} no agarra.`,
          data: { joint: u.id, type: u.type, piece: thin[0].id, thickness: thin[1] },
          alternatives: [{ key: 'change-joint', description: 'Clavo sin cabeza con pegamento', data: { type: 'glue-nail' } }],
        },
      ]

    const minimums = ASSUMPTIONS.joints[u.type as keyof typeof ASSUMPTIONS.joints] as { a?: number; b?: number; bCritical?: number } | undefined
    if (!minimums) return []
    const found: Finding[] = []
    if (minimums.a !== undefined && ta < minimums.a) found.push(tooThin(u, a, ta, minimums.a, 'critical', catalog))
    if (minimums.b !== undefined && tb < minimums.b) {
      const severity = minimums.bCritical !== undefined && tb >= minimums.bCritical ? 'recommendation' : 'critical'
      found.push(tooThin(u, b, tb, minimums.b, severity, catalog))
    }
    if ((u.type === 'dado' || u.type === 'rabbet') && u.depth !== null) {
      const fraction = u.depth / tb
      const severity: Severity | null = fraction > ASSUMPTIONS.penetration.critical ? 'critical' : fraction > ASSUMPTIONS.penetration.recommended ? 'recommendation' : null
      if (severity)
        found.push({
          code: 'R2_JOINT_THICKNESS',
          severity,
          pieces: [u.a, u.b],
          message: `El ${u.type} de ${u.depth} mm debilita ${b.name} (${tb} mm); lo recomendable es hasta ${roundTo(tb * ASSUMPTIONS.penetration.recommended)} mm.`,
          data: { joint: u.id, type: u.type, piece: b.id, thickness: tb, penetration: u.depth },
          alternatives: [{ key: 'shallower-groove', description: `Hacer el ${u.type} de ${roundTo(tb * ASSUMPTIONS.penetration.recommended, 0)} mm`, data: { penetration: roundTo(tb * ASSUMPTIONS.penetration.recommended, 0) } }],
        })
    }
    return found
  })
