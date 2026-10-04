import { DIMENSION_OF_AXIS, DIMENSION_LABEL, AXES, isDrawerPart, type Axis, type Design, type Piece } from '../schema'
import { faceSize, roundTo, type Box, type Geometry } from '../resolve'
import { usableSheet, materialById, type Catalog } from '../../materials/catalog'
import { CONTACT_TOLERANCE, bounds } from '../boxes'
import { contacts, samePair, gapBetween, type Contact } from './contact'
import { error, type DesignWarning, type DesignError } from './errors'
import { cite, noReference, STRUCTURE, VALUES, type Source } from '../../sources'

// Whether the pieces make a piece of furniture: its measures add up, joints join touching pieces, nothing overlaps or floats, and every piece fits a sheet.
// The error payloads (code, message, data) keep their shape: the expert reads them, and they share their shape with the structural findings.

const MEASURE_TOLERANCE = 1
/** The widest gap between a drawer and the piece beside it that a runner can bridge. */
const RUNNER_GAP = 20
/** An inset door hangs in its opening with this much gap all around: its hinge joins pieces that do not touch. */
const HINGE_GAP = 4
/** The longest stretch of a seam between two panels that may have nothing under it: the top of the reference's 600–700 for a platform. */
const SEAM_SPAN = 700
export const GEOMETRY_SOURCES: Record<string, Source> = {
  MEASURE_TOLERANCE: noReference('slack for rounding between the declared measures and where the pieces end'),
  RUNNER_GAP: noReference('how far a runner joint may reach before it is an error; the gap the slide needs is R9’s, reported with its fix'),
  // 2–3 mm between fronts, and a millimetre of slack.
  HINGE_GAP: cite(VALUES, '8-puertas', 'Separación entre frentes'),
  SEAM_SPAN: cite(STRUCTURE, '73-camas', 'también necesita apoyos a cada ≈ 600–700 mm'),
}
const NO_JOINT_WARNING = new Set(['door', 'drawer-front'])

/** Two parts (groups, like a headboard) already joined may also touch at an edge without a joint: each piece is held by its own part. */
function joinedParts(design: Design, byId: Map<string, Piece>, a: Piece, b: Piece): boolean {
  const [partA, partB] = [a.group ?? null, b.group ?? null]
  if (partA === partB || isDrawerPart(a) || isDrawerPart(b)) return false
  return design.joints.some((u) => {
    const [x, y] = [byId.get(u.a)?.group ?? null, byId.get(u.b)?.group ?? null]
    return (x === partA && y === partB) || (x === partB && y === partA)
  })
}

const near = (a: number, b: number) => Math.abs(a - b) <= CONTACT_TOLERANCE
const low = (b: Box, axis: Axis) => b[`${axis}0`]
const high = (b: Box, axis: Axis) => b[`${axis}1`]

/** Coplanar panels of one role meeting edge to edge are a seam, not a joint, while supports joined to both leave no stretch of it longer than SEAM_SPAN. */
function supportedSeam(design: Design, boxes: Map<string, Box>, c: Contact, a: Piece, b: Piece): boolean {
  if (a.role !== b.role || a.normal !== b.normal || !c.axis || c.axis === a.normal) return false
  const [boxA, boxB] = [boxes.get(a.id), boxes.get(b.id)]
  if (!boxA || !boxB || !near(low(boxA, a.normal), low(boxB, a.normal)) || !near(high(boxA, a.normal), high(boxB, a.normal))) return false
  const across = c.axis
  const seam = near(high(boxA, across), low(boxB, across)) ? high(boxA, across) : high(boxB, across)
  const along = AXES.find((e) => e !== across && e !== a.normal)!
  const from = Math.max(low(boxA, along), low(boxB, along))
  const to = Math.min(high(boxA, along), high(boxB, along))
  if (to <= from) return false
  const joined = (id: string, other: string) => design.joints.some((u) => samePair(u, id, other))
  const stretches = design.pieces
    .filter((p) => p.id !== a.id && p.id !== b.id && joined(p.id, a.id) && joined(p.id, b.id))
    .flatMap((p) => boxes.get(p.id) ?? [])
    .filter((s) => low(s, across) < seam - CONTACT_TOLERANCE && high(s, across) > seam + CONTACT_TOLERANCE)
    .map((s): [number, number] => [Math.max(from, low(s, along)), Math.min(to, high(s, along))])
    .filter(([start, end]) => end > start)
    .sort((x, y) => x[0] - y[0])
  let reached = from
  let widest = 0
  for (const [start, end] of stretches) {
    widest = Math.max(widest, start - reached)
    reached = Math.max(reached, end)
  }
  return Math.max(widest, to - reached) <= SEAM_SPAN
}

interface GeometryValidation {
  errors: DesignError[]
  warnings: DesignWarning[]
  contacts: Contact[]
}

export function validateGeometry(design: Design, geo: Geometry, catalog: Catalog): GeometryValidation {
  const errors: DesignError[] = []
  const warnings: DesignWarning[] = []
  const all = contacts(geo.boxes)
  const byId = new Map(design.pieces.map((p) => [p.id, p]))

  const around = bounds(geo.boxes.values())
  for (const axis of AXES) {
    const min = around[`${axis}0`]
    const max = around[`${axis}1`]
    const expected = design.dimensions[DIMENSION_OF_AXIS[axis]]
    if (geo.boxes.size && (Math.abs(min) > MEASURE_TOLERANCE || Math.abs(max - expected) > MEASURE_TOLERANCE))
      errors.push(
        error('E_OVERALL_SIZE', `Las piezas ocupan de ${roundTo(min)} a ${roundTo(max)} mm en ${DIMENSION_LABEL[DIMENSION_OF_AXIS[axis]]}, pero el mueble mide ${expected} mm.`, {
          axis: axis,
          from: roundTo(min),
          to: roundTo(max),
          expected: expected,
        }),
      )
  }

  for (const u of design.joints) {
    const missing = [u.a, u.b].filter((id) => !byId.has(id))
    if (missing.length) {
      errors.push(error('E_UNKNOWN_PIECE', `La unión "${u.id}" refiere ${missing.map((f) => `"${f}"`).join(' y ')}, que no existe.`, { joint: u.id, pieces: missing }))
      continue
    }
    if (u.type === 'drawer-slide') {
      const gap = gapBetween(geo.boxes.get(u.a)!, geo.boxes.get(u.b)!)
      if (!gap || gap.axis !== 'x' || gap.distance > RUNNER_GAP)
        errors.push(error('E_JOINT_WITHOUT_CONTACT', `La corredera "${u.id}" necesita a "${u.a}" y "${u.b}" uno frente al otro a lo ancho, a menos de ${RUNNER_GAP} mm.`, { joint: u.id, a: u.a, b: u.b }))
      continue
    }
    if (u.type === 'cup-hinge' && !all.some((c) => samePair(c, u.a, u.b))) {
      const gap = gapBetween(geo.boxes.get(u.a)!, geo.boxes.get(u.b)!)
      if (!gap || gap.distance > HINGE_GAP)
        errors.push(error('E_JOINT_WITHOUT_CONTACT', `La bisagra "${u.id}" necesita a "${u.a}" junto a "${u.b}", a menos de ${HINGE_GAP} mm.`, { joint: u.id, a: u.a, b: u.b }))
      continue
    }
    if (!all.some((c) => samePair(c, u.a, u.b)))
      errors.push(error('E_JOINT_WITHOUT_CONTACT', `La unión "${u.id}" junta "${u.a}" y "${u.b}", pero no se tocan.`, { joint: u.id, a: u.a, b: u.b }))
  }

  // Touching pieces connect; overlapping ones only where a joint lets one go into the other (a groove, a rabbet).
  const connections = all.filter((c) => {
    if (c.axis) return true
    const allowed = design.joints.some((u) => samePair(u, c.a, c.b) && u.depth !== null && c.depth <= u.depth + CONTACT_TOLERANCE)
    if (!allowed) errors.push(error('E_OVERLAP', `"${c.a}" y "${c.b}" se enciman ${roundTo(c.depth)} mm.`, { a: c.a, b: c.b, depth: roundTo(c.depth) }))
    return allowed
  })

  // Runners and hinges hold pieces that do not touch; from the floor up, whatever is not reached floats.
  const hanging = design.joints.filter((u) => (u.type === 'drawer-slide' || u.type === 'cup-hinge') && geo.boxes.has(u.a) && geo.boxes.has(u.b))
  connections.push(...hanging.map((u) => ({ a: u.a, b: u.b, axis: 'x' as const, depth: 0 })))
  const reached = new Set([...geo.boxes].filter(([, c]) => c.y0 <= CONTACT_TOLERANCE).map(([id]) => id))
  for (let changed = true; changed; ) {
    changed = false
    for (const c of connections) {
      if (reached.has(c.a) !== reached.has(c.b)) {
        reached.add(c.a).add(c.b)
        changed = true
      }
    }
  }
  // A drawer hangs from its runners: whether it has something to hang from is a drawer rule (R9), with a way to fix it.
  const drawerParts = new Set(design.pieces.filter((p) => isDrawerPart(p) && p.group).map((p) => p.id))
  for (const id of geo.boxes.keys())
    if (!reached.has(id) && !drawerParts.has(id)) errors.push(error('E_FLOATING', `"${id}" no se apoya en nada: no toca ninguna pieza conectada al piso.`, { piece: id }))

  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    const material = materialById(catalog, p.material)
    if (!box || !material) continue
    const [length, width] = faceSize(box, p.normal)
    const sheet = usableSheet(catalog, material)
    if (length > sheet.length || width > sheet.width)
      errors.push(
        error('E_TOO_BIG_FOR_SHEET', `"${p.id}" mide ${roundTo(length)} × ${roundTo(width)} mm y la hoja útil es de ${sheet.length} × ${sheet.width} mm.`, {
          piece: p.id,
          length: roundTo(length),
          width: roundTo(width),
          sheet: sheet,
        }),
      )
  }

  for (const c of connections) {
    const a = byId.get(c.a)!
    const b = byId.get(c.b)!
    if ([a, b].some((p) => NO_JOINT_WARNING.has(p.role) || p.support === 'movable')) continue
    if (!design.joints.some((u) => samePair(u, c.a, c.b)) && !supportedSeam(design, geo.boxes, c, a, b) && !joinedParts(design, byId, a, b))
      warnings.push({ code: 'W_CONTACT_WITHOUT_JOINT', message: `"${c.a}" y "${c.b}" se tocan pero no tienen unión.`, data: { a: c.a, b: c.b } })
  }

  return { errors, warnings, contacts: all }
}
