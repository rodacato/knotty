import { ASSUMPTIONS } from '../structure/assumptions'
import { hardwareByRole, pickHardware, slideForBox, type Catalog } from '../materials/catalog'
import { contacts, type Contact } from '../validation/contact'
import { makeJoint } from './builders'
import { JOINTS } from './jointSpecs'
import { isDrawerPart, type Design, type Piece, type Joint } from './schema'
import { drawerSides } from './drawers'
import { resolveGeometry, type Box } from './resolve'

// Common joints come from geometry, not from the expert, so they are the same with any model. The expert only declares special ones.

const pairKey = (a: string, b: string) => [a, b].sort().join('|')

/** The joint with the catalog's usual hardware for its type, if the catalog has any. */
function withHardware(catalog: Catalog, a: string, b: string, type: 'glue-nail' | 'shelf-pin' | 'cup-hinge', count: number | null): Omit<Joint, 'id'> {
  const role = JOINTS[type].hardware
  const item = role && pickHardware(catalog, role)
  return makeJoint('', a, b, type, item ? [{ hardwareId: item.id, count }] : [])
}

/** The shortest screw that bites enough into the edge, or the longest that does not poke out when it goes into a face. */
function screwFor(catalog: Catalog, thicknessA: number, thicknessB: number, intoFace: boolean) {
  const screws = hardwareByRole(catalog, 'screw').filter((h) => h.length).sort((x, y) => x.length! - y.length!)
  if (intoFace) return [...screws].reverse().find((t) => t.length! <= thicknessA + thicknessB - 3) ?? screws[0]
  return screws.find((t) => t.length! - thicknessA >= ASSUMPTIONS.screws.minPenetration) ?? screws.at(-1)
}

function inferJoint(c: Contact, p: Piece, q: Piece, thicknesses: Map<string, number>, catalog: Catalog): Omit<Joint, 'id'> | null {
  const back = p.role === 'back' ? p : q.role === 'back' ? q : null
  if (back) {
    const other = back === p ? q : p
    // A shelf that moves is not nailed to the back.
    if (other.role === 'back' || other.support === 'movable') return null
    return withHardware(catalog, back.id, other.id, 'glue-nail', null)
  }

  const movable = p.support === 'movable' ? p : q.support === 'movable' ? q : null
  if (movable) {
    const other = movable === p ? q : p
    if (movable.role !== 'shelf' || other.normal !== 'x' || c.axis !== 'x') return null
    return withHardware(catalog, movable.id, other.id, 'shelf-pin', 2)
  }

  // The screw goes through the piece that touches with its face and into the other's edge; edge to edge is not screwed.
  const byFace = [p, q].filter((x) => x.normal === c.axis)
  if (!byFace.length) return null
  const a = byFace.length === 1 ? byFace[0] : [p, q].sort((x, y) => thicknesses.get(x.id)! - thicknesses.get(y.id)! || x.id.localeCompare(y.id))[0]
  const b = a === p ? q : p
  const ta = thicknesses.get(a.id)!
  if (ta <= ASSUMPTIONS.nailOnlyThickness) return withHardware(catalog, a.id, b.id, 'glue-nail', null)
  const t = screwFor(catalog, ta, thicknesses.get(b.id)!, byFace.length === 2)
  return makeJoint('', a.id, b.id, 'butt-screw', t ? [{ hardwareId: t.id, count: null }] : [])
}

/** A door hangs from the upright closest to one of its edges. */
function hinge(door: Piece, box: Box, neighbours: { piece: Piece; box: Box }[], catalog: Catalog): Omit<Joint, 'id'> | null {
  const uprights = neighbours.filter((x) => x.piece.normal === 'x' && x.piece.role !== 'door')
  if (!uprights.length) return null
  const center = (k: Box) => (k.x0 + k.x1) / 2
  const distance = (k: Box) => Math.min(Math.abs(center(k) - box.x0), Math.abs(center(k) - box.x1))
  // On a tie, the left one: it is what someone opening it expects.
  const chosen = [...uprights].sort((m, n) => distance(m.box) - distance(n.box) || center(m.box) - center(n.box))[0]
  return withHardware(catalog, door.id, chosen.piece.id, 'cup-hinge', null)
}

/** Adds missing joints; with `previous`, only where the change created a contact, so a joint removed on purpose does not come back. */
export function completeJoints(design: Design, catalog: Catalog, previous?: Design): Design {
  const resolved = resolveGeometry(design, catalog)
  if (!resolved.ok) return design
  const { boxes, thicknesses } = resolved.value
  const byId = new Map(design.pieces.map((p) => [p.id, p]))
  const joined = new Set(design.joints.map((u) => pairKey(u.a, u.b)))
  const ids = new Set(design.joints.map((u) => u.id))
  const before = previous && resolveGeometry(previous, catalog)
  // Only real contacts count as earlier: two pieces that overlapped were not joined, they were wrong.
  const earlierContacts = new Set(before && before.ok ? contacts(before.value.boxes).filter((c) => c.axis !== null).map((c) => pairKey(c.a, c.b)) : [])

  const added: Joint[] = []
  const add = (u: Omit<Joint, 'id'> | null) => {
    if (!u) return
    let id = `j-${u.a}-${u.b}`
    for (let n = 2; ids.has(id); n++) id = `j-${u.a}-${u.b}-${n}`
    ids.add(id)
    joined.add(pairKey(u.a, u.b))
    added.push({ ...u, id })
  }

  const touching = contacts(boxes).filter((c) => c.axis !== null && !joined.has(pairKey(c.a, c.b)) && !earlierContacts.has(pairKey(c.a, c.b)))
  for (const c of touching) {
    const p = byId.get(c.a)!
    const q = byId.get(c.b)!
    // Doors are handled apart, and drawer pieces already bring their joints; other groups are just how the model organizes parts.
    if (p.role === 'door' || q.role === 'door' || isDrawerPart(p) || isDrawerPart(q)) continue
    add(inferJoint(c, p, q, thicknesses, catalog))
  }

  for (const door of design.pieces.filter((p) => p.role === 'door')) {
    if ([...joined].some((k) => k.split('|').includes(door.id))) continue
    const neighbours = touching.filter((c) => c.a === door.id || c.b === door.id).map((c) => byId.get(c.a === door.id ? c.b : c.a)!)
    add(hinge(door, boxes.get(door.id)!, neighbours.map((piece) => ({ piece, box: boxes.get(piece.id)! })), catalog))
  }

  // A drawer that came without runners gets them on the pieces beside its box, as long as the box; R9 then checks the gap and the length.
  const withRunner = new Set(design.joints.filter((u) => u.type === 'drawer-slide').flatMap((u) => [u.a, u.b]))
  const groupsWithHardware = new Set(design.joints.filter((u) => u.type === 'drawer-slide' && u.hardware.length).flatMap((u) => [byId.get(u.a)?.group, byId.get(u.b)?.group]))
  for (const { group, side, support } of drawerSides(design, boxes)) {
    const box = boxes.get(side.id)!
    const runner = slideForBox(catalog, box.z1 - box.z0)
    if (!runner || !support || withRunner.has(side.id)) continue
    // One runner in the catalog is a pair: the first side carries it, the other goes without hardware.
    const hardware = groupsWithHardware.has(group) ? [] : [{ hardwareId: runner.id, count: 1 }]
    groupsWithHardware.add(group)
    add({ a: side.id, b: support.piece.id, type: 'drawer-slide', glue: false, hardware: hardware, depth: null })
  }

  return added.length ? { ...design, joints: [...design.joints, ...added] } : design
}
