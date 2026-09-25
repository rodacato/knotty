import type { Load, Piece } from '../../design/schema'
import { roundTo, type Box } from '../../design/resolve'
import type { Catalog } from '../../materials/catalog'
import type { Alternative, Finding, Rule, Severity } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

// R1: how much a horizontal piece sags between its supports under its load.

const LOAD_NAME: Record<Load, string> = { none: 'sin carga', light: 'carga ligera', medium: 'carga media', heavy: 'libros' }

/** Simply supported beam under a uniform load: δ = 5·w·L⁴ / (384·E·I) × creep. In mm. */
export function deflection(span: number, depth: number, thickness: number, load: Load, modulus: number) {
  const w = (ASSUMPTIONS.loads[load] * ASSUMPTIONS.gravity * depth) / 1e6
  const inertia = (depth * thickness ** 3) / 12
  return ((5 * w * span ** 4) / (384 * modulus * inertia)) * ASSUMPTIONS.creep
}

/** The longest span whose sag stays within span / the recommended limit. */
export function maxSpan(depth: number, thickness: number, load: Load, modulus: number) {
  const w = (ASSUMPTIONS.loads[load] * ASSUMPTIONS.gravity * depth) / 1e6
  const inertia = (depth * thickness ** 3) / 12
  return Math.cbrt((384 * modulus * inertia) / (5 * w * ASSUMPTIONS.creep * ASSUMPTIONS.deflectionLimit.recommended))
}

export function deflectionSeverity(delta: number, span: number): Severity | null {
  if (delta > span / ASSUMPTIONS.deflectionLimit.critical) return 'critical'
  if (delta > span / ASSUMPTIONS.deflectionLimit.recommended) return 'recommendation'
  return null
}

function modulusByGrain(p: Piece, box: Box) {
  const longSideIsX = box.x1 - box.x0 >= box.z1 - box.z0
  const grainAlongX = p.grain === 'length' ? longSideIsX : p.grain === 'width' ? !longSideIsX : false
  return grainAlongX ? ASSUMPTIONS.elasticModulus.parallel : ASSUMPTIONS.elasticModulus.perpendicular
}

/** The longest free span between upright supports: those touching its ends or holding it from below. */
export function freeSpan(id: string, box: Box, ctx: Parameters<Rule>[0]) {
  const supports = ctx.contacts
    .filter((c) => c.a === id || c.b === id)
    .map((c) => (c.a === id ? c.b : c.a))
    .filter((other) => {
      const piece = ctx.design.pieces.find((p) => p.id === other)
      const o = ctx.geo.boxes.get(other)
      if (!piece || !o || piece.normal !== 'x' || piece.role === 'door') return false
      return Math.abs(o.x1 - box.x0) <= 0.5 || Math.abs(o.x0 - box.x1) <= 0.5 || Math.abs(o.y1 - box.y0) <= 0.5
    })
    .map((other) => ctx.geo.boxes.get(other)!)
    .sort((a, b) => a.x0 - b.x0)
  if (supports.length < 2) return null
  let span = 0
  for (let i = 1; i < supports.length; i++) span = Math.max(span, supports[i].x0 - Math.max(...supports.slice(0, i).map((a) => a.x1)))
  return span > 0 ? span : null
}

function alternatives(p: Piece, span: number, depth: number, thickness: number, load: Load, modulus: number, catalog: Catalog): Alternative[] {
  const list: Alternative[] = []
  const thicker = catalog.materials.filter((m) => m.type === 'plywood' && m.thickness > thickness).sort((a, b) => a.thickness - b.thickness)[0]
  if (thicker)
    list.push({
      key: 'thicker-board',
      description: `Subir a ${thicker.name}`,
      data: { material: thicker.id, sag: roundTo(deflection(span, depth, thicker.thickness, load, modulus)) },
    })
  const half = (span - thickness) / 2
  list.push({
    key: 'center-divider',
    description: p.role === 'bottom' ? 'Agregar un apoyo al centro, debajo del piso' : 'Agregar un divisor vertical al centro',
    data: { span: roundTo(half, 0), sag: roundTo(deflection(half, depth, thickness, load, modulus)) },
  })
  list.push({ key: 'max-span', description: `Claro máximo con ${thickness} mm`, data: { span: roundTo(maxSpan(depth, thickness, load, modulus), 0) } })
  return list
}

export const deflectionRule: Rule = (ctx) =>
  ctx.design.pieces.flatMap((p): Finding[] => {
    const box = ctx.geo.boxes.get(p.id)
    const thickness = ctx.geo.thicknesses.get(p.id)
    if (!box || !thickness || p.normal !== 'y' || p.load === 'none') return []
    const span = freeSpan(p.id, box, ctx)
    if (!span) return []
    const depth = box.z1 - box.z0
    const modulus = modulusByGrain(p, box)
    const delta = deflection(span, depth, thickness, p.load, modulus)
    const severity = deflectionSeverity(delta, span)
    if (!severity) return []
    const limit = span / ASSUMPTIONS.deflectionLimit.recommended
    return [
      {
        code: 'R1_SAG',
        severity,
        pieces: [p.id],
        message: `${p.name} se pandearía ~${roundTo(delta)} mm con ${LOAD_NAME[p.load]} en un claro de ${roundTo(span, 0)} mm (lo aceptable es hasta ${roundTo(limit)} mm).`,
        data: { span: roundTo(span, 0), depth: roundTo(depth, 0), thickness: thickness, load: p.load, sag: roundTo(delta), limit: roundTo(limit), modulus: modulus },
        alternatives: alternatives(p, span, depth, thickness, p.load, modulus, ctx.catalog),
      },
    ]
  })
