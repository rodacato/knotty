import { analizar } from '../analisis'
import { desde, pieza, ref, tramo, union } from '../diseno/construir'
import type { Diseno, Pieza } from '../diseno/esquema'
import { completeJoints } from '../diseno/joints'
import { normalizar } from '../diseno/normalizador'
import type { Alternativa, Hallazgo } from '../estructura/hallazgo'
import type { Catalogo } from '../materiales/catalogo'
import { aplicar } from '../operaciones/aplicar'
import type { Operacion } from '../operaciones/esquema'

// Solutions Knotty can build by itself for a finding: previewed and applied at once, no expert involved.

export interface Fix {
  /** The alternative it implements, as the rule named it. */
  key: string
  label: string
  operations: Operacion[]
  design: Diseno
}

const RAIL_HEIGHT = 80
/** A support shallower than this holds nothing up. */
const MIN_SUPPORT_DEPTH = 100
const uniqueId = (design: Diseno, base: string) => {
  let id = base
  for (let n = 2; design.piezas.some((p) => p.id === id); n++) id = `${base}-${n}`
  return id
}

/** A vertical support under the middle of a horizontal piece, down to what is below it, dodging what is in its way. */
function centerSupport(design: Diseno, catalog: Catalogo, target: Pieza): Operacion[] {
  const analysis = analizar(design, catalog)
  const geo = analysis.geo
  const box = geo?.cajas.get(target.id)
  if (!geo || !box || target.normal !== 'y') return []
  const thickness = geo.espesores.get(target.id) ?? 18
  const x0 = Math.round((box.x0 + box.x1) / 2 - thickness / 2)
  const x1 = x0 + thickness
  const inColumn = [...geo.cajas.entries()].filter(([id, b]) => id !== target.id && b.x0 < x1 && b.x1 > x0 && Math.min(b.z1, box.z1) - Math.max(b.z0, box.z0) > 0)
  // What it stands on: the highest piece clearly below; pieces touching the target (a kick under the floor) are obstacles, not a base.
  const base = inColumn.filter(([, b]) => b.y1 < box.y0 - 1).sort(([, a], [, b]) => b.y1 - a.y1)[0]
  const bottom = base ? base[1].y1 : 0
  const obstacles = inColumn.filter(([, b]) => b.y1 > bottom + 0.5 && b.y0 < box.y0 - 0.5).map(([, b]) => [b.z0, b.z1] as const)
  let free: [number, number][] = [[box.z0, box.z1]]
  for (const [z0, z1] of obstacles) free = free.flatMap(([a, b]): [number, number][] => (z1 <= a || z0 >= b ? [[a, b]] : ([[a, Math.min(b, z0)], [Math.max(a, z1), b]] as [number, number][]).filter(([c, d]) => d - c > 0)))
  const [z0, z1] = free.sort(([a, b], [c, d]) => d - c - (b - a))[0] ?? [0, 0]
  if (z1 - z0 < MIN_SUPPORT_DEPTH) return []
  const support = pieza({
    id: uniqueId(design, `apoyo-${target.id}`),
    nombre: `Apoyo de ${target.nombre.toLowerCase()}`,
    rol: 'divisor',
    material: target.material,
    normal: 'x',
    x: desde({ tipo: 'mm', mm: x0 }),
    y: tramo(base ? ref(`${base[0]}.y1`) : ref('mueble.y0'), ref(`${target.id}.y0`)),
    z: tramo({ tipo: 'mm', mm: Math.round(z0) }, { tipo: 'mm', mm: Math.round(z1) }),
    cantos: ['frente'],
  })
  return [{ op: 'agregarPieza', pieza: support }]
}

/** A rail across the back, just under the top: to hang the piece from the wall or to keep it square. */
function backRail(design: Diseno, role: 'refuerzo' | 'faja', name: string): Operacion[] {
  const sides = design.piezas.filter((p) => p.rol === 'lateral' && p.normal === 'x')
  const top = design.piezas.find((p) => p.rol === 'techo')
  if (sides.length < 2 || !top) return []
  const [left, right] = [sides[0], sides[sides.length - 1]]
  const back = design.piezas.find((p) => p.rol === 'trasera')
  const id = uniqueId(design, role === 'refuerzo' ? 'liston-colgar' : 'faja-trasera')
  const rail = pieza({
    id,
    nombre: name,
    rol: role,
    material: left.material,
    normal: 'z',
    x: tramo(ref(`${left.id}.x1`), ref(`${right.id}.x0`)),
    y: tramo(null, ref(`${top.id}.y0`), RAIL_HEIGHT),
    z: desde(back ? ref(`${back.id}.z1`) : ref('mueble.z0')),
  })
  const operations: Operacion[] = [{ op: 'agregarPieza', pieza: rail }]
  // A rigid rail is what keeps a box square: pocket screws into both sides, not butt screws.
  if (role === 'faja')
    for (const side of [left, right]) operations.push({ op: 'agregarUnion', union: union(`u-${id}-${side.id}`, id, side.id, 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]) })
  return operations
}

function operationsFor(design: Diseno, catalog: Catalogo, finding: Hallazgo, alternative: Alternativa): Operacion[] {
  const pieces = finding.piezas.map((id) => design.piezas.find((p) => p.id === id)).filter((p): p is Pieza => !!p)
  switch (alternative.clave) {
    case 'subir-espesor':
      return typeof alternative.datos.material === 'string' ? [{ op: 'cambiarEspesor', ids: pieces.map((p) => p.id), material: alternative.datos.material }] : []
    case 'divisor-al-centro':
    case 'apoyo-central':
      return pieces.filter((p) => p.normal === 'y').flatMap((p) => centerSupport(design, catalog, p))
    case 'anclar-muro':
      return design.anclajeMuro ? [] : [{ op: 'cambiarAnclajeMuro', valor: true }]
    case 'liston-colgar':
      return backRail(design, 'refuerzo', 'Listón de colgar')
    case 'faja-rigida':
      return backRail(design, 'faja', 'Faja trasera')
    default:
      return []
  }
}

/** The alternatives of a finding that Knotty can build and that leave a valid design, each with its result. */
export function fixesFor(design: Diseno, catalog: Catalogo, finding: Hallazgo): Fix[] {
  return finding.alternativas.flatMap((alternative) => {
    const operations = operationsFor(design, catalog, finding, alternative)
    if (!operations.length) return []
    const result = aplicar(design, operations, catalog)
    if (!result.ok) return []
    const built = completeJoints(normalizar(result.valor.diseno, catalog), catalog, design)
    if (!analizar(built, catalog).valido) return []
    return [{ key: alternative.clave, label: alternative.descripcion, operations, design: built }]
  })
}
