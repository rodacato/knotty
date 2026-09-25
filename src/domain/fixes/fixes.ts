import { analizar } from '../analisis'
import { startAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Diseno, Pieza } from '../diseno/esquema'
import { drawerSides } from '../diseno/drawers'
import { completeJoints } from '../diseno/joints'
import { normalize } from '../diseno/normalize'
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
  const box = geo?.boxes.get(target.id)
  if (!geo || !box || target.normal !== 'y') return []
  const thickness = geo.thicknesses.get(target.id) ?? 18
  const x0 = Math.round((box.x0 + box.x1) / 2 - thickness / 2)
  const x1 = x0 + thickness
  const inColumn = [...geo.boxes.entries()].filter(([id, b]) => id !== target.id && b.x0 < x1 && b.x1 > x0 && Math.min(b.z1, box.z1) - Math.max(b.z0, box.z0) > 0)
  // What it stands on: the highest piece clearly below; pieces touching the target (a kick under the floor) are obstacles, not a base.
  const base = inColumn.filter(([, b]) => b.y1 < box.y0 - 1).sort(([, a], [, b]) => b.y1 - a.y1)[0]
  const bottom = base ? base[1].y1 : 0
  const obstacles = inColumn.filter(([, b]) => b.y1 > bottom + 0.5 && b.y0 < box.y0 - 0.5).map(([, b]) => [b.z0, b.z1] as const)
  let free: [number, number][] = [[box.z0, box.z1]]
  for (const [z0, z1] of obstacles) free = free.flatMap(([a, b]): [number, number][] => (z1 <= a || z0 >= b ? [[a, b]] : ([[a, Math.min(b, z0)], [Math.max(a, z1), b]] as [number, number][]).filter(([c, d]) => d - c > 0)))
  const [z0, z1] = free.sort(([a, b], [c, d]) => d - c - (b - a))[0] ?? [0, 0]
  if (z1 - z0 < MIN_SUPPORT_DEPTH) return []
  const support = makePiece({
    id: uniqueId(design, `apoyo-${target.id}`),
    nombre: `Apoyo de ${target.nombre.toLowerCase()}`,
    rol: 'divisor',
    material: target.material,
    normal: 'x',
    x: startAt({ tipo: 'mm', mm: x0 }),
    y: extent(base ? ref(`${base[0]}.y1`) : ref('mueble.y0'), ref(`${target.id}.y0`)),
    z: extent({ tipo: 'mm', mm: Math.round(z0) }, { tipo: 'mm', mm: Math.round(z1) }),
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
  const rail = makePiece({
    id,
    nombre: name,
    rol: role,
    material: left.material,
    normal: 'z',
    x: extent(ref(`${left.id}.x1`), ref(`${right.id}.x0`)),
    y: extent(null, ref(`${top.id}.y0`), RAIL_HEIGHT),
    z: startAt(back ? ref(`${back.id}.z1`) : ref('mueble.z0')),
  })
  const operations: Operacion[] = [{ op: 'agregarPieza', pieza: rail }]
  // A rigid rail is what keeps a box square: pocket screws into both sides, not butt screws.
  if (role === 'faja')
    for (const side of [left, right]) operations.push({ op: 'agregarUnion', union: makeJoint(`u-${id}-${side.id}`, id, side.id, 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]) })
  return operations
}

/** A piece beside a drawer, at the runner's gap, from what is below it to what is above: something to screw the runner to. */
function runnerSupportPiece(design: Diseno, catalog: Catalogo, group: string, side: 'izq' | 'der'): Operacion[] {
  const geo = analizar(design, catalog).geo
  const runner = catalog.herrajes.find((h) => h.id.startsWith('corredera') && h.holguraLateral !== null)
  const found = geo && drawerSides(design, geo.boxes).find((d) => d.group === group && d.towards === (side === 'izq' ? -1 : 1))
  if (!geo || !runner?.holguraLateral || !found) return []
  const material = design.piezas.find((p) => p.rol === 'lateral')?.material ?? found.side.material
  const thickness = catalog.materiales.find((m) => m.id === material)?.espesor ?? 18
  const box = geo.boxes.get(found.side.id)!
  const drawer = design.piezas.filter((p) => p.grupo === group && geo.boxes.has(p.id)).map((p) => geo.boxes.get(p.id)!)
  const [bottom, top] = [Math.min(...drawer.map((b) => b.y0)), Math.max(...drawer.map((b) => b.y1))]
  const x0 = side === 'izq' ? box.x0 - runner.holguraLateral - thickness : box.x1 + runner.holguraLateral
  const inColumn = [...geo.boxes.entries()].filter(([id, b]) => !drawer.includes(b) && id !== found.side.id && b.x0 < x0 + thickness && b.x1 > x0 && Math.min(b.z1, box.z1) - Math.max(b.z0, box.z0) > 0)
  const below = inColumn.filter(([, b]) => b.y1 <= bottom + 0.5).sort(([, a], [, b]) => b.y1 - a.y1)[0]
  const above = inColumn.filter(([, b]) => b.y0 >= top - 0.5).sort(([, a], [, b]) => a.y0 - b.y0)[0]
  const id = uniqueId(design, `apoyo-${group}-${side}`)
  const support = makePiece({
    id,
    nombre: `Apoyo de corredera ${side === 'izq' ? 'izquierdo' : 'derecho'}`,
    rol: 'divisor',
    material,
    normal: 'x',
    x: startAt({ tipo: 'mm', mm: Math.round(x0 * 10) / 10 }),
    y: extent(below ? ref(`${below[0]}.y1`) : ref('mueble.y0'), above ? ref(`${above[0]}.y0`) : { tipo: 'mm', mm: Math.round(top) }),
    z: extent({ tipo: 'mm', mm: Math.round(box.z0) }, { tipo: 'mm', mm: Math.round(box.z1) }),
    cantos: ['frente'],
  })
  const hasHardware = design.uniones.some((u) => u.tipo === 'corredera' && u.herrajes.length && design.piezas.find((p) => p.id === u.a || p.id === u.b)?.grupo === group)
  return [
    { op: 'agregarPieza', pieza: support },
    { op: 'agregarUnion', union: makeJoint(`u-${group}-corredera-${side}`, found.side.id, id, 'corredera', hasHardware ? [] : [{ herrajeId: runner.id, cantidad: 1 }]) },
  ]
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
    case 'apoyo-corredera':
      return typeof alternative.datos.grupo === 'string' && (alternative.datos.lado === 'izq' || alternative.datos.lado === 'der') ? runnerSupportPiece(design, catalog, alternative.datos.grupo, alternative.datos.lado) : []
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
    const built = completeJoints(normalize(result.valor.diseno, catalog), catalog, design)
    if (!analizar(built, catalog).valido) return []
    return [{ key: alternative.clave, label: alternative.descripcion, operations, design: built }]
  })
}
