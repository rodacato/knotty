import { analyze } from '../../checks/analysis'
import { startAt, makePiece, ref, extent, makeJoint } from '../../design/builders'
import type { Design, Piece } from '../../design/schema'
import { drawerSides } from '../../design/drawers'
import { completeJoints } from '../../design/joints'
import { normalize } from '../../design/normalize'
import { findingKey, type Alternative, type Finding } from '../../checks/structure/finding'
import { isBuildKey, type AlternativeKey } from '../../checks/structure/alternatives'
import { materialById, slideForBox, type Catalog, type HardwareRole } from '../../materials/catalog'
import { pocketScrewId } from '../../checks/structure/assumptions'
import { applyOperations } from '../operations/apply'
import type { Operation } from '../operations/schema'

// Solutions Knotty can build by itself for a finding: previewed and applied at once, no expert involved.

export interface Fix {
  /** The alternative it implements, as the rule named it. */
  key: AlternativeKey
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
function backRail(design: Design, catalog: Catalog, role: 'brace' | 'apron', name: string): Operation[] {
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
    for (const side of [left, right]) operations.push({ op: 'addJoint', joint: makeJoint(`j-${id}-${side.id}`, id, side.id, 'pocket-screw', [{ hardwareId: pocketScrewId(materialById(catalog, left.material)?.thickness ?? 18), count: 2 }]) })
  return operations
}

/** A piece beside a drawer, at the runner's gap, from what is below it to what is above: something to screw the runner to. */
function runnerSupportPiece(design: Design, catalog: Catalog, group: string, side: 'left' | 'right'): Operation[] {
  const geo = analyze(design, catalog).geo
  const found = geo && drawerSides(design, geo.boxes).find((d) => d.group === group && d.towards === (side === 'left' ? -1 : 1))
  if (!geo || !found) return []
  const box = geo.boxes.get(found.side.id)!
  const runner = slideForBox(catalog, box.z1 - box.z0)
  if (!runner) return []
  const material = design.pieces.find((p) => p.role === 'side')?.material ?? found.side.material
  const thickness = catalog.materials.find((m) => m.id === material)?.thickness ?? 18
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

/** The joint the alternative names with the hardware it names, in place of the item of that role it had: the same count, the right hinge or slide. */
function swapHardware(design: Design, catalog: Catalog, alternative: Alternative, role: HardwareRole): Operation[] {
  const { joint: id, hardwareId } = alternative.data
  const joint = design.joints.find((u) => u.id === id)
  if (!joint || typeof hardwareId !== 'string' || catalog.hardware.find((h) => h.id === hardwareId)?.role !== role) return []
  const hardware = joint.hardware.map((h) => (catalog.hardware.find((x) => x.id === h.hardwareId)?.role === role ? { ...h, hardwareId } : h))
  return [{ op: 'changeJoint', joint: { ...joint, hardware } }]
}

function operationsFor(design: Design, catalog: Catalog, finding: Finding, alternative: Alternative): Operation[] {
  const pieces = finding.pieces.map((id) => design.pieces.find((p) => p.id === id)).filter((p): p is Piece => !!p)
  const key = alternative.key
  if (!isBuildKey(key)) return []
  // One case per key declared 'build': a new one does not compile until it is built here.
  switch (key) {
    case 'thicker-board': {
      // R2 names the one piece that is too thin for the joint; R1 names none, and every sagging piece of the finding gets the board.
      const { material, piece } = alternative.data
      if (typeof material !== 'string') return []
      const ids = typeof piece === 'string' ? pieces.filter((p) => p.id === piece).map((p) => p.id) : pieces.map((p) => p.id)
      return ids.length ? [{ op: 'changeMaterial', ids, material }] : []
    }
    case 'center-divider':
    case 'center-support':
      return pieces.filter((p) => p.normal === 'y').flatMap((p) => centerSupport(design, catalog, p))
    case 'anchor-to-wall':
      return design.wallAnchored ? [] : [{ op: 'setWallAnchored', value: true }]
    case 'hanging-rail':
      return backRail(design, catalog, 'brace', 'Listón de colgar')
    case 'rigid-apron':
      return backRail(design, catalog, 'apron', 'Faja trasera')
    case 'slide-support':
      return typeof alternative.data.group === 'string' && (alternative.data.side === 'left' || alternative.data.side === 'right') ? runnerSupportPiece(design, catalog, alternative.data.group, alternative.data.side) : []
    case 'matching-hinge':
      return swapHardware(design, catalog, alternative, 'hinge')
    case 'matching-slide':
      return swapHardware(design, catalog, alternative, 'drawer-slide')
    default: {
      const unbuilt: never = key
      return unbuilt
    }
  }
}

/** The alternatives of a finding that Knotty can build and that leave a valid design, each with its result. */
export function fixesFor(design: Design, catalog: Catalog, finding: Finding): Fix[] {
  return finding.alternatives.flatMap((alternative) => build(design, catalog, alternative, operationsFor(design, catalog, finding, alternative)))
}

/**
 * One solution for every finding of a notice: five sagging shelves get five supports in one click.
 * A thicker board is per finding: each joint too thin thickens its own piece, and a piece named twice takes the thicker board.
 */
export function fixesForNotice(design: Design, catalog: Catalog, findings: Finding[]): Fix[] {
  const [first] = findings
  if (!first) return []
  const together = { ...first, pieces: [...new Set(findings.flatMap((h) => h.pieces))] }
  return first.alternatives.flatMap((alternative) => {
    const perPiece = alternative.key === 'thicker-board' && typeof alternative.data.piece === 'string'
    return build(design, catalog, alternative, perPiece ? thickerPieces(catalog, findings) : operationsFor(design, catalog, together, alternative))
  })
}

/** One alternative built for every finding that offers it, like a notice does, only if it clears them all; null leaves it to the expert. */
export function fixForAlternative(design: Design, catalog: Catalog, findings: Finding[], key: string): Fix | null {
  const offering = findings.filter((h) => h.alternatives.some((a) => a.key === key))
  const fix = fixesForNotice(design, catalog, offering.map((h) => ({ ...h, alternatives: h.alternatives.filter((a) => a.key === key) })))[0]
  if (!fix) return null
  const after = analyze(fix.design, catalog)
  const left = new Set((after.valid ? after.findings : []).filter((h) => h.severity === 'critical').map(findingKey))
  return offering.some((h) => left.has(findingKey(h))) ? null : fix
}

function thickerPieces(catalog: Catalog, findings: Finding[]): Operation[] {
  const thickness = (id: string) => materialById(catalog, id)?.thickness ?? 0
  const chosen = new Map<string, string>()
  for (const { key, data } of findings.flatMap((h) => h.alternatives)) {
    if (key !== 'thicker-board' || typeof data.piece !== 'string' || typeof data.material !== 'string') continue
    const current = chosen.get(data.piece)
    if (!current || thickness(data.material) > thickness(current)) chosen.set(data.piece, data.material)
  }
  const byMaterial = new Map<string, string[]>()
  for (const [piece, material] of chosen) byMaterial.set(material, [...(byMaterial.get(material) ?? []), piece])
  return [...byMaterial].map(([material, ids]): Operation => ({ op: 'changeMaterial', ids, material }))
}

function build(design: Design, catalog: Catalog, alternative: Alternative, operations: Operation[]): Fix[] {
  if (!operations.length) return []
  const result = applyOperations(design, operations, catalog)
  if (!result.ok) return []
  const built = completeJoints(normalize(result.value.design, catalog), catalog, design)
  if (!analyze(built, catalog).valid) return []
  return [{ key: alternative.key, label: alternative.description, operations, design: built }]
}
