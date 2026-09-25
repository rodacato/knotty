import type { Carga, Pieza } from '../../diseno/esquema'
import { roundTo, type Box } from '../../diseno/resolve'
import type { Catalogo } from '../../materiales/catalogo'
import type { Alternative, Finding, Rule, Severity } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

// R1: how much a horizontal piece sags between its supports under its load.

const LOAD_NAME: Record<Carga, string> = { ninguna: 'sin carga', ligera: 'carga ligera', media: 'carga media', pesada: 'libros' }

/** Simply supported beam under a uniform load: δ = 5·w·L⁴ / (384·E·I) × creep. In mm. */
export function deflection(span: number, depth: number, thickness: number, load: Carga, modulus: number) {
  const w = (ASSUMPTIONS.loads[load] * ASSUMPTIONS.gravity * depth) / 1e6
  const inertia = (depth * thickness ** 3) / 12
  return ((5 * w * span ** 4) / (384 * modulus * inertia)) * ASSUMPTIONS.creep
}

/** The longest span whose sag stays within span / the recommended limit. */
export function maxSpan(depth: number, thickness: number, load: Carga, modulus: number) {
  const w = (ASSUMPTIONS.loads[load] * ASSUMPTIONS.gravity * depth) / 1e6
  const inertia = (depth * thickness ** 3) / 12
  return Math.cbrt((384 * modulus * inertia) / (5 * w * ASSUMPTIONS.creep * ASSUMPTIONS.deflectionLimit.recommended))
}

export function deflectionSeverity(delta: number, span: number): Severity | null {
  if (delta > span / ASSUMPTIONS.deflectionLimit.critical) return 'critico'
  if (delta > span / ASSUMPTIONS.deflectionLimit.recommended) return 'recomendacion'
  return null
}

function modulusByGrain(p: Pieza, box: Box) {
  const longSideIsX = box.x1 - box.x0 >= box.z1 - box.z0
  const grainAlongX = p.veta === 'largo' ? longSideIsX : p.veta === 'ancho' ? !longSideIsX : false
  return grainAlongX ? ASSUMPTIONS.elasticModulus.parallel : ASSUMPTIONS.elasticModulus.perpendicular
}

/** The longest free span between upright supports: those touching its ends or holding it from below. */
export function freeSpan(id: string, box: Box, ctx: Parameters<Rule>[0]) {
  const supports = ctx.contacts
    .filter((c) => c.a === id || c.b === id)
    .map((c) => (c.a === id ? c.b : c.a))
    .filter((other) => {
      const piece = ctx.design.piezas.find((p) => p.id === other)
      const o = ctx.geo.boxes.get(other)
      if (!piece || !o || piece.normal !== 'x' || piece.rol === 'puerta') return false
      return Math.abs(o.x1 - box.x0) <= 0.5 || Math.abs(o.x0 - box.x1) <= 0.5 || Math.abs(o.y1 - box.y0) <= 0.5
    })
    .map((other) => ctx.geo.boxes.get(other)!)
    .sort((a, b) => a.x0 - b.x0)
  if (supports.length < 2) return null
  let span = 0
  for (let i = 1; i < supports.length; i++) span = Math.max(span, supports[i].x0 - Math.max(...supports.slice(0, i).map((a) => a.x1)))
  return span > 0 ? span : null
}

function alternatives(p: Pieza, span: number, depth: number, thickness: number, load: Carga, modulus: number, catalog: Catalogo): Alternative[] {
  const list: Alternative[] = []
  const thicker = catalog.materiales.filter((m) => m.tipo === 'triplay' && m.espesor > thickness).sort((a, b) => a.espesor - b.espesor)[0]
  if (thicker)
    list.push({
      key: 'subir-espesor',
      description: `Subir a ${thicker.nombre}`,
      data: { material: thicker.id, flecha: roundTo(deflection(span, depth, thicker.espesor, load, modulus)) },
    })
  const half = (span - thickness) / 2
  list.push({
    key: 'divisor-al-centro',
    description: p.rol === 'piso' ? 'Agregar un apoyo al centro, debajo del piso' : 'Agregar un divisor vertical al centro',
    data: { claro: roundTo(half, 0), flecha: roundTo(deflection(half, depth, thickness, load, modulus)) },
  })
  list.push({ key: 'claro-maximo', description: `Claro máximo con ${thickness} mm`, data: { claro: roundTo(maxSpan(depth, thickness, load, modulus), 0) } })
  return list
}

export const deflectionRule: Rule = (ctx) =>
  ctx.design.piezas.flatMap((p): Finding[] => {
    const box = ctx.geo.boxes.get(p.id)
    const thickness = ctx.geo.thicknesses.get(p.id)
    if (!box || !thickness || p.normal !== 'y' || p.carga === 'ninguna') return []
    const span = freeSpan(p.id, box, ctx)
    if (!span) return []
    const depth = box.z1 - box.z0
    const modulus = modulusByGrain(p, box)
    const delta = deflection(span, depth, thickness, p.carga, modulus)
    const severity = deflectionSeverity(delta, span)
    if (!severity) return []
    const limit = span / ASSUMPTIONS.deflectionLimit.recommended
    return [
      {
        code: 'R1_FLECHA',
        severity,
        pieces: [p.id],
        message: `${p.nombre} se pandearía ~${roundTo(delta)} mm con ${LOAD_NAME[p.carga]} en un claro de ${roundTo(span, 0)} mm (lo aceptable es hasta ${roundTo(limit)} mm).`,
        data: { claro: roundTo(span, 0), fondo: roundTo(depth, 0), espesor: thickness, carga: p.carga, flecha: roundTo(delta), limite: roundTo(limit), moduloE: modulus },
        alternatives: alternatives(p, span, depth, thickness, p.carga, modulus, ctx.catalog),
      },
    ]
  })
