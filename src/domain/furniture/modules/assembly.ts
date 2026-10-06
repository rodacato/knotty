import { z } from 'zod'
import { JOINTS } from '../../design/jointSpecs'
import { hardwareFor } from '../../design/joints'
import { hardwarePerJoint } from '../../design/hardwareCount'
import { resolveGeometry, type Geometry } from '../../design/resolve'
import { isDrawerPart, type Design, type Dimensions, type Joint, type JointType, type Piece } from '../../design/schema'
import { contactBetween } from '../../design/validation/contact'
import { ASSUMPTIONS } from '../../assumptions'
import type { Catalog } from '../../materials/catalog'
import { cite, type Source } from '../../sources'
import { choice, fromLabels, note, type FieldSpec } from './fields'
import type { Labels } from './module'
import type { PartSpec } from './parts'

// How a piece of furniture is put together: glued for good, or knocked down to move it. Every module's plan takes it the same way.

export const Assembly = z.enum(['glued', 'bolts', 'cams'])
export type Assembly = z.infer<typeof Assembly>

export const ASSEMBLY_LABELS = {
  glued: { option: 'Fijo', phrase: 'armado fijo, con pegamento' },
  bolts: { option: 'Con pernos', phrase: 'desarmable con pernos' },
  cams: { option: 'Con minifix', phrase: 'desarmable con minifix' },
} satisfies Labels<Assembly>

/** The door and the ceiling a piece has to get past whole, and the length a stair turn lets through. */
export const NARROW_DOOR = 800
export const DOOR_HEIGHT = 2100
export const CEILING = 2300
export const LONGEST_WHOLE = 1800

const FABRICATION = 'fabricacion-y-armado.md'
export const ASSEMBLY_SOURCES: Record<string, Source> = {
  NARROW_DOOR: cite(FABRICATION, '82-medidas-mínimas-de-paso-cdmx', 'Ancho de puerta de cocina y baño | 0.80 m'),
  DOOR_HEIGHT: cite(FABRICATION, '82-medidas-mínimas-de-paso-cdmx', 'Altura de puertas | 2.10 m'),
  CEILING: cite(FABRICATION, '83-reglas-para-el-diseño', 'en un techo de 2300 mm pasa por 19 mm'),
  LONGEST_WHOLE: cite(FABRICATION, '83-reglas-para-el-diseño', 'Si pasa de 1.80 m de largo, conviene hacerlo en módulos'),
}

/** Whether it has to come apart to get where it goes: it does not pass a door, cannot be stood up under the ceiling, or is too long to turn on a stair. */
export function needsKnockDown({ width, height, depth }: Dimensions): boolean {
  const [small, middle, large] = [width, height, depth].sort((a, b) => a - b)
  const passesDoor = small <= NARROW_DOOR && middle <= DOOR_HEIGHT
  const stands = height <= DOOR_HEIGHT || Math.hypot(height, depth) < CEILING
  return !passesDoor || !stands || large > LONGEST_WHOLE
}

/** What each choice tries, in order: a bolt needs a thicker board than a minifix, which takes its place where the bolt does not fit. */
const FITTING: Record<Exclude<Assembly, 'glued'>, JointType[]> = { bolts: ['connector-bolt', 'cam-lock'], cams: ['cam-lock'] }
/** Strips that ride on a bigger board: they keep their screws and take no fitting. */
const TRIM_ROLES = new Set<Piece['role']>(['brace', 'kick', 'other'])
const CONVERTED = new Set<JointType>(['butt-screw', 'pocket-screw', 'glue-nail'])

const thickEnough = (type: JointType, ta: number, tb: number) => ta >= (JOINTS[type].minThickness?.a ?? 0) && tb >= (JOINTS[type].minThickness?.b ?? 0)

/** Nothing glued but drawers, laminated legs and what `moduleOf` puts in the same module: a box built apart that arrives whole. An upright board going into another's edge takes the fitting; one laid over the frame, trim and a thin back are screwed in place (fabricacion-y-armado.md §8.4). */
export function knockDown(design: Design, assembly: Assembly | undefined, catalog: Catalog, moduleOf: (piece: Piece) => string | undefined = () => undefined): Design {
  if (!assembly || assembly === 'glued') return design
  const geo = resolveGeometry(design, catalog)
  if (!geo.ok) return design
  const { boxes, thicknesses } = geo.value
  const byId = new Map(design.pieces.map((p) => [p.id, p]))

  const apart = (u: Joint): Joint => {
    const [p, q] = [byId.get(u.a), byId.get(u.b)]
    if (!p || !q || isDrawerPart(p) || isDrawerPart(q) || !CONVERTED.has(u.type)) return u
    if (moduleOf(p) && moduleOf(p) === moduleOf(q)) return u
    const [boxP, boxQ] = [boxes.get(p.id)!, boxes.get(q.id)!]
    const axis = contactBetween(p.id, boxP, q.id, boxQ)?.axis
    const through = [p, q].filter((x) => x.normal === axis)
    // Two boards face to face over the same outline are one laminated piece, as the layers of a leg: it stays glued.
    const sameOutline = (['x', 'y', 'z'] as const).filter((e) => e !== axis).every((e) => boxP[`${e}0`] === boxQ[`${e}0`] && boxP[`${e}1`] === boxQ[`${e}1`])
    if (through.length === 2 && sameOutline) return u
    // Neither board goes through the other, or both do: there is no edge to take a fitting, so the joint keeps its fastener.
    if (through.length !== 1) return { ...u, glue: false }
    const [a, b] = [through[0], through[0] === p ? q : p]
    const [ta, tb] = [thicknesses.get(a.id)!, thicknesses.get(b.id)!]
    const inPlace = a.normal === 'y' || TRIM_ROLES.has(a.role) || TRIM_ROLES.has(b.role)
    const fitting = inPlace ? undefined : FITTING[assembly].find((type) => thickEnough(type, ta, tb))
    const joined = { ...u, a: a.id, b: b.id, glue: false }
    if (fitting) return { ...joined, type: fitting, depth: null, hardware: hardwareFor(catalog, fitting, a, b, boxes, thicknesses) }
    // A back too thin for a screw stays nailed.
    if (ta <= ASSUMPTIONS.nailOnlyThickness) return { ...u, glue: false }
    return { ...joined, type: 'butt-screw', hardware: hardwareFor(catalog, 'butt-screw', a, b, boxes, thicknesses) }
  }
  return { ...design, joints: design.joints.map(apart) }
}

type WithAssembly = { assembly?: Assembly }

/** The plan's field, the same in every module, with what knocking down asks of the person. */
export const assemblyFields = <P extends WithAssembly>(): FieldSpec<P>[] => [
  choice<P, Assembly>({ key: 'assembly', label: 'Armado', ...fromLabels(ASSEMBLY_LABELS), get: (p) => p.assembly ?? 'glued', set: (p, assembly) => ({ ...p, assembly }) }),
  note<P>('Pernos M6 con tuerca de barril: la cabeza del perno queda a la vista por fuera y la tuerca por dentro. Donde el tablero tiene menos de 18 mm no cabe la tuerca y va un minifix.', (p) => p.assembly === 'bolts', 'assembly'),
  note<P>('Minifix de 15 mm con dos tarugos sueltos en cada unión: por fuera no se ve, la excéntrica queda por dentro.', (p) => p.assembly === 'cams', 'assembly'),
  note<P>('Desarmable va sin pegamento: se arma en su lugar y se vuelve a escuadrar por diagonales cada vez. Los cajones siguen pegados. Los barrenos piden plantilla, o que la maderería los haga.', (p) => !!p.assembly && p.assembly !== 'glued', 'assembly'),
]

/** The joints that come apart with a fitting, and how many each one takes. */
export function fittedJoints(design: Design, geo: Pick<Geometry, 'boxes'>): { joint: Joint; count: number }[] {
  return design.joints.filter((u) => u.type === 'connector-bolt' || u.type === 'cam-lock').map((joint) => ({ joint, count: joint.hardware[0]?.count ?? hardwarePerJoint(joint, geo) }))
}

/** Its part in the list of every kind. */
export const assemblyPart = <P extends WithAssembly>(): PartSpec<P> => ({
  id: 'assembly',
  name: 'Armado',
  side: 'outside',
  fields: ['assembly'],
  joints: [],
  summary: (plan) => ASSEMBLY_LABELS[plan.assembly ?? 'glued'].option,
})

export const describeAssembly = (before: WithAssembly, after: WithAssembly): string[] => ((before.assembly ?? 'glued') === (after.assembly ?? 'glued') ? [] : [ASSEMBLY_LABELS[after.assembly ?? 'glued'].phrase])
