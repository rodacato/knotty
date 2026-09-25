import { analyze } from '../analysis'
import { startAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Design, Piece } from '../diseno/schema'
import { drawerSides } from '../diseno/drawers'
import { completeJoints } from '../diseno/joints'
import { normalize } from '../diseno/normalize'
import type { Alternative, Finding } from '../structure/finding'
import type { Catalog } from '../materiales/catalog'
import { applyOperations } from '../operaciones/apply'
import type { Operation } from '../operaciones/schema'

// Solutions Knotty can build by itself for a finding: previewed and applied at once, no expert involved.

export interface Fix {
  /** The alternative it implements, as the rule named it. */
  key: string
  label: string
  operations: Operation[]
  design: Design
}

const RAIL_HEIGHT = 80
/** A support shallower than this holds nothing up. */
const MIN_SUPPORT_DEPTH = 100
const uniqueId = (design: Design, base: string) => {
  let id = base
  for (let n = 2; design.pieces.some((p) => p.id === id); n++) id = `${base}-${n}`
  return id
}

/** A vertical support under the middle of a horizontal piece, down to what is below it, dodging what is in its way. */
function centerSupport(design: Design, catalog: Catalog, target: Piece): Operation[] {
  const analysis = analyze(design, catalog)
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
    id: uniqueId(design, `support-${target.id}`),
    name: `Apoyo de ${target.name.toLowerCase()}`,
    role: 'divider',
    material: target.material,
    normal: 'x',
    x: startAt({ type: 'mm', mm: x0 }),
    y: extent(base ? ref(`${base[0]}.y1`) : ref('furniture.y0'), ref(`${target.id}.y0`)),
    z: extent({ type: 'mm', mm: Math.round(z0) }, { type: 'mm', mm: Math.round(z1) }),
    edges: ['front'],
  })
  return [{ op: 'addPiece', piece: support }]
}

/** A rail across the back, just under the top: to hang the piece from the wall or to keep it square. */
function backRail(design: Design, role: 'brace' | 'apron', name: string): Operation[] {
  const sides = design.pieces.filter((p) => p.role === 'side' && p.normal === 'x')
  const top = design.pieces.find((p) => p.role === 'top')
  if (sides.length < 2 || !top) return []
  const [left, right] = [sides[0], sides[sides.length - 1]]
  const back = design.pieces.find((p) => p.role === 'back')
  const id = uniqueId(design, role === 'brace' ? 'hanging-rail' : 'back-apron')
  const rail = makePiece({
    id,
    name: name,
    role: role,
    material: left.material,
    normal: 'z',
    x: extent(ref(`${left.id}.x1`), ref(`${right.id}.x0`)),
    y: extent(null, ref(`${top.id}.y0`), RAIL_HEIGHT),
    z: startAt(back ? ref(`${back.id}.z1`) : ref('furniture.z0')),
  })
  const operations: Operation[] = [{ op: 'addPiece', piece: rail }]
  // A rigid rail is what keeps a box square: pocket screws into both sides, not butt screws.
  if (role === 'apron')
    for (const side of [left, right]) operations.push({ op: 'addJoint', joint: makeJoint(`j-${id}-${side.id}`, id, side.id, 'pocket-screw', [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }]) })
  return operations
}

/** A piece beside a drawer, at the runner's gap, from what is below it to what is above: something to screw the runner to. */
function runnerSupportPiece(design: Design, catalog: Catalog, group: string, side: 'left' | 'right'): Operation[] {
  const geo = analyze(design, catalog).geo
  const runner = catalog.hardware.find((h) => h.id.startsWith('drawer-slide') && h.sideClearance !== null)
  const found = geo && drawerSides(design, geo.boxes).find((d) => d.group === group && d.towards === (side === 'left' ? -1 : 1))
  if (!geo || !runner?.sideClearance || !found) return []
  const material = design.pieces.find((p) => p.role === 'side')?.material ?? found.side.material
  const thickness = catalog.materials.find((m) => m.id === material)?.thickness ?? 18
  const box = geo.boxes.get(found.side.id)!
  const drawer = design.pieces.filter((p) => p.group === group && geo.boxes.has(p.id)).map((p) => geo.boxes.get(p.id)!)
  const [bottom, top] = [Math.min(...drawer.map((b) => b.y0)), Math.max(...drawer.map((b) => b.y1))]
  const x0 = side === 'left' ? box.x0 - runner.sideClearance - thickness : box.x1 + runner.sideClearance
  const inColumn = [...geo.boxes.entries()].filter(([id, b]) => !drawer.includes(b) && id !== found.side.id && b.x0 < x0 + thickness && b.x1 > x0 && Math.min(b.z1, box.z1) - Math.max(b.z0, box.z0) > 0)
  const below = inColumn.filter(([, b]) => b.y1 <= bottom + 0.5).sort(([, a], [, b]) => b.y1 - a.y1)[0]
  const above = inColumn.filter(([, b]) => b.y0 >= top - 0.5).sort(([, a], [, b]) => a.y0 - b.y0)[0]
  const id = uniqueId(design, `support-${group}-${side}`)
  const support = makePiece({
    id,
    name: `Apoyo de corredera ${side === 'left' ? 'izquierdo' : 'derecho'}`,
    role: 'divider',
    material,
    normal: 'x',
    x: startAt({ type: 'mm', mm: Math.round(x0 * 10) / 10 }),
    y: extent(below ? ref(`${below[0]}.y1`) : ref('furniture.y0'), above ? ref(`${above[0]}.y0`) : { type: 'mm', mm: Math.round(top) }),
    z: extent({ type: 'mm', mm: Math.round(box.z0) }, { type: 'mm', mm: Math.round(box.z1) }),
    edges: ['front'],
  })
  const hasHardware = design.joints.some((u) => u.type === 'drawer-slide' && u.hardware.length && design.pieces.find((p) => p.id === u.a || p.id === u.b)?.group === group)
  return [
    { op: 'addPiece', piece: support },
    { op: 'addJoint', joint: makeJoint(`j-${group}-slide-${side}`, found.side.id, id, 'drawer-slide', hasHardware ? [] : [{ hardwareId: runner.id, count: 1 }]) },
  ]
}

function operationsFor(design: Design, catalog: Catalog, finding: Finding, alternative: Alternative): Operation[] {
  const pieces = finding.pieces.map((id) => design.pieces.find((p) => p.id === id)).filter((p): p is Piece => !!p)
  switch (alternative.key) {
    case 'thicker-board':
      return typeof alternative.data.material === 'string' ? [{ op: 'changeMaterial', ids: pieces.map((p) => p.id), material: alternative.data.material }] : []
    case 'center-divider':
    case 'center-support':
      return pieces.filter((p) => p.normal === 'y').flatMap((p) => centerSupport(design, catalog, p))
    case 'anchor-to-wall':
      return design.wallAnchored ? [] : [{ op: 'setWallAnchored', value: true }]
    case 'hanging-rail':
      return backRail(design, 'brace', 'Listón de colgar')
    case 'rigid-apron':
      return backRail(design, 'apron', 'Faja trasera')
    case 'slide-support':
      return typeof alternative.data.group === 'string' && (alternative.data.side === 'left' || alternative.data.side === 'right') ? runnerSupportPiece(design, catalog, alternative.data.group, alternative.data.side) : []
    default:
      return []
  }
}

/** The alternatives of a finding that Knotty can build and that leave a valid design, each with its result. */
export function fixesFor(design: Design, catalog: Catalog, finding: Finding): Fix[] {
  return finding.alternatives.flatMap((alternative) => {
    const operations = operationsFor(design, catalog, finding, alternative)
    if (!operations.length) return []
    const result = applyOperations(design, operations, catalog)
    if (!result.ok) return []
    const built = completeJoints(normalize(result.value.design, catalog), catalog, design)
    if (!analyze(built, catalog).valid) return []
    return [{ key: alternative.key, label: alternative.description, operations, design: built }]
  })
}
