import type { HardwareRole } from '../materials/catalog'
import type { JointType } from './schema'

// What Knotty knows about each kind of joint, in one place: adding a joint type does not compile until it is described here.

export interface JointSpec {
  /** Its name for the person: after «una unión con», and as the piece panel lists it (after a count, «3 tarugos»). */
  label: { singular: string; plural: string }
  /** The least board, in mm, on the piece being fastened (a) and on the one that takes it (b); from bCritical up, a thinner b is only a recommendation. */
  minThickness: { a?: number; b?: number; bCritical?: number } | null
  /** It keeps a frame square on its own: rails joined this way to both sides stop racking. */
  rigid: boolean
  /** It holds a board as thin as a back (ASSUMPTIONS.nailOnlyThickness): nailed, or in a groove or rabbet. */
  holdsThinBoard: boolean
  /** Glued unless the model says otherwise. */
  glue: boolean
  /** The hardware it takes from the catalog; null when the joint is the cut itself. */
  hardware: HardwareRole | null
}

const SPECS = {
  'butt-screw': {
    label: { singular: 'tornillo al canto', plural: 'tornillo al canto' },
    minThickness: { b: 15, bCritical: 12 },
    rigid: false,
    holdsThinBoard: false,
    glue: true,
    hardware: 'screw',
  },
  'pocket-screw': {
    label: { singular: 'tornillo de bolsillo', plural: 'tornillo de bolsillo' },
    minThickness: { a: 12, b: 12 },
    rigid: true,
    holdsThinBoard: false,
    glue: true,
    hardware: 'pocket-screw',
  },
  dowel: {
    label: { singular: 'tarugo', plural: 'tarugos' },
    minThickness: { a: 15, b: 15 },
    rigid: true,
    holdsThinBoard: false,
    glue: true,
    hardware: 'dowel',
  },
  'cam-lock': {
    label: { singular: 'minifix', plural: 'minifix' },
    minThickness: { a: 15, b: 15 },
    rigid: true,
    holdsThinBoard: false,
    glue: true,
    hardware: 'cam-lock',
  },
  dado: {
    label: { singular: 'canal', plural: 'canal' },
    minThickness: { b: 15 },
    rigid: true,
    holdsThinBoard: true,
    glue: true,
    hardware: null,
  },
  rabbet: {
    label: { singular: 'rebaje', plural: 'rebaje' },
    minThickness: { b: 15 },
    rigid: true,
    holdsThinBoard: true,
    glue: true,
    hardware: null,
  },
  bracket: {
    label: { singular: 'escuadra', plural: 'escuadra' },
    minThickness: null,
    rigid: true,
    holdsThinBoard: false,
    glue: true,
    hardware: 'bracket',
  },
  'glue-nail': {
    label: { singular: 'clavo y pegamento', plural: 'clavo y pegamento' },
    minThickness: null,
    rigid: false,
    holdsThinBoard: true,
    glue: true,
    hardware: 'nail',
  },
  'shelf-pin': {
    label: { singular: 'soporte de repisa', plural: 'soportes de repisa' },
    minThickness: { b: 15 },
    rigid: false,
    holdsThinBoard: false,
    glue: false,
    hardware: 'shelf-pin',
  },
  'cup-hinge': {
    label: { singular: 'bisagra de cazoleta', plural: 'bisagras de cazoleta' },
    minThickness: { a: 15 },
    rigid: false,
    holdsThinBoard: false,
    glue: false,
    hardware: 'hinge',
  },
  'drawer-slide': {
    label: { singular: 'corredera', plural: 'corredera' },
    minThickness: null,
    rigid: false,
    holdsThinBoard: false,
    glue: false,
    hardware: 'drawer-slide',
  },
} satisfies Record<JointType, JointSpec>

/** Read through the interface, so every joint type has the same fields. */
export const JOINTS: Readonly<Record<JointType, JointSpec>> = SPECS
