import { jointThicknessRule } from '../../checks/structure/rules/jointThickness'
import type { Finding } from '../../checks/structure/finding'
import { JOINTS } from '../../design/jointSpecs'
import { hardwareFor } from '../../design/joints'
import { resolveGeometry, type Geometry } from '../../design/resolve'
import { isDrawerPart, type Design, type Joint, type JointType, type Piece } from '../../design/schema'
import type { Catalog } from '../../materials/catalog'
import type { Operation } from '../operations/schema'

// The person picks how a group of pieces is joined; the chosen type and its hardware replace the ones Knotty inferred.

/** They fasten the same pieces without cutting any: a groove or a rabbet changes the cut list, so it is not picked here. */
const CHOOSABLE_JOINTS = ['butt-screw', 'pocket-screw', 'dowel', 'plugged-dowel', 'cam-lock', 'connector-bolt', 'glue-nail', 'bracket'] as const satisfies readonly JointType[]
export type ChoosableJoint = (typeof CHOOSABLE_JOINTS)[number]
export const isChoosable = (type: string): type is ChoosableJoint => (CHOOSABLE_JOINTS as readonly string[]).includes(type)

const CUT_JOINTS: JointType[] = ['dado', 'rabbet', 'finger']
const STRUCTURAL = new Set<JointType>([...CHOOSABLE_JOINTS, ...CUT_JOINTS])

export type JointGroupId = 'body' | 'base' | 'back' | 'drawers'

export interface JointGroup {
  id: JointGroupId
  /** «Cuerpo: laterales con piso y techo». */
  label: string
  /** «Unión del cuerpo». */
  title: string
  joints: Joint[]
  /** The type most of its joints have. */
  current: JointType
}

function groupOf(u: Joint, byId: Map<string, Piece>): JointGroupId | null {
  const [a, b] = [byId.get(u.a), byId.get(u.b)]
  if (!a || !b || !STRUCTURAL.has(u.type)) return null
  const roles = [a.role, b.role]
  // A drawer bottom is nailed into its box, and a drawer hangs from its runners: neither is a corner to choose.
  if (roles.includes('drawer-bottom') || isDrawerPart(a) !== isDrawerPart(b)) return null
  if (isDrawerPart(a)) return 'drawers'
  if (roles.includes('back')) return 'back'
  if (roles.includes('apron') || roles.includes('kick')) return 'base'
  return 'body'
}

const ORDER: JointGroupId[] = ['body', 'base', 'back', 'drawers']

function labels(id: JointGroupId, pieces: Piece[]): Pick<JointGroup, 'label' | 'title'> {
  const has = (role: Piece['role']) => pieces.some((p) => p.role === role)
  if (id === 'body') return { label: has('side') && (has('top') || has('bottom')) ? 'Cuerpo: laterales con piso y techo' : 'Cuerpo', title: 'Unión del cuerpo' }
  if (id === 'base') return { label: has('kick') ? 'Base: zoclo' : 'Base: patas y faldones', title: 'Unión de la base' }
  if (id === 'back') return { label: 'Trasera', title: 'Unión de la trasera' }
  return { label: 'Cajones', title: 'Unión de los cajones' }
}

function mostCommon(joints: Joint[]): JointType {
  const counts = new Map<JointType, number>()
  for (const u of joints) counts.set(u.type, (counts.get(u.type) ?? 0) + 1)
  return [...counts].sort((x, y) => y[1] - x[1])[0][0]
}

/** The groups of joints a design has, in a fixed order; one without joints is left out. */
export function jointGroups(design: Design): JointGroup[] {
  const byId = new Map(design.pieces.map((p) => [p.id, p]))
  return ORDER.flatMap((id) => {
    const joints = design.joints.filter((u) => groupOf(u, byId) === id)
    if (!joints.length) return []
    const pieces = [...new Set(joints.flatMap((u) => [u.a, u.b]))].map((p) => byId.get(p)!)
    return [{ id, ...labels(id, pieces), joints, current: mostCommon(joints) }]
  })
}

export interface JointChoice {
  operations: Operation[]
  /** What R2 finds on the joints it changes, with the chosen type and the design's boards. */
  findings: Finding[]
  /** Joints of the group left as they are because they are cut into the board (groove, rabbet). */
  kept: number
}

/** Every joint of the group becomes `type`, with its hardware; nothing is applied here. */
export function chooseJoint(design: Design, geo: Geometry, group: JointGroupId, type: ChoosableJoint, catalog: Catalog): JointChoice {
  const byId = new Map(design.pieces.map((p) => [p.id, p]))
  const joints = jointGroups(design).find((g) => g.id === group)?.joints ?? []
  const changed = joints
    .filter((u) => !CUT_JOINTS.includes(u.type) && u.type !== type)
    .map((u): Joint => ({ ...u, type, glue: JOINTS[type].glue, depth: null, hardware: hardwareFor(catalog, type, byId.get(u.a)!, byId.get(u.b)!, geo.boxes, geo.thicknesses) }))
  const ids = new Set(changed.map((u) => u.id))
  const next: Design = { ...design, joints: design.joints.map((u) => changed.find((c) => c.id === u.id) ?? u) }
  const findings = jointThicknessRule({ design: next, geo, catalog, contacts: [] }).filter((f) => ids.has(String(f.data.joint)))
  return { operations: changed.map((joint) => ({ op: 'changeJoint', joint })), findings, kept: joints.filter((u) => CUT_JOINTS.includes(u.type)).length }
}

/** What Knotty infers for a new contact: a nailed back, a screwed corner anywhere else. */
const inferred = (group: JointGroupId): JointType => (group === 'back' ? 'glue-nail' : 'butt-screw')

/**
 * A choice is of the group, not of the joints it had that day: the ones that came later, still as Knotty inferred them, take the type of the `settled` ones.
 * Only when at least two settled joints agree on a type, and never where R2 finds it critical on that board.
 */
export function followChoice(design: Design, settled: Set<string>, catalog: Catalog): Design {
  const resolved = resolveGeometry(design, catalog)
  if (!resolved.ok) return design
  const geo = resolved.value
  const byId = new Map(design.pieces.map((p) => [p.id, p]))
  const followed = jointGroups(design).flatMap((group) => {
    const chosen = group.joints.filter((u) => settled.has(u.id) && !CUT_JOINTS.includes(u.type))
    const type = chosen[0]?.type
    if (chosen.length < 2 || !isChoosable(type) || type === inferred(group.id) || chosen.some((u) => u.type !== type)) return []
    return group.joints
      .filter((u) => !settled.has(u.id) && u.type === inferred(group.id))
      .map((u): Joint => ({ ...u, type, glue: JOINTS[type].glue, depth: null, hardware: hardwareFor(catalog, type, byId.get(u.a)!, byId.get(u.b)!, geo.boxes, geo.thicknesses) }))
  })
  if (!followed.length) return design
  const next: Design = { ...design, joints: design.joints.map((u) => followed.find((f) => f.id === u.id) ?? u) }
  const refused = new Set(jointThicknessRule({ design: next, geo, catalog, contacts: [] }).filter((f) => f.severity === 'critical').map((f) => String(f.data.joint)))
  return { ...design, joints: design.joints.map((u) => followed.find((f) => f.id === u.id && !refused.has(f.id)) ?? u) }
}
