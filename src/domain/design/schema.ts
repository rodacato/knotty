import { z } from 'zod'

// Axes: X = width, Y = height, Z = depth (back → front); origin at the bottom-left-back corner; everything in mm.
// Optional fields are `nullable`, so the same schema works as the models' strict output. Field names are what the expert reads and what is saved; descriptions stay in Spanish until the prompts move to English.

export const AXES = ['x', 'y', 'z'] as const
export const Axis = z.enum(AXES)
export type Axis = z.infer<typeof Axis>

export const FaceRef = z
  .string()
  .regex(/^[a-z0-9-]+\.[xyz][01]$/, 'Formato "<pieza>.<eje><0|1>", por ejemplo "side-left.x1" o "furniture.y0"')
  .describe('A face: 0 = the smaller, 1 = the larger. "furniture" is the outside faces of the furniture')
export type FaceRef = z.infer<typeof FaceRef>

export const Position = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mm'), mm: z.number() }).describe('Absolute position from the origin of the furniture'),
  z.object({ type: z.literal('ref'), ref: FaceRef, offset: z.number() }).describe('A face of another piece or of the furniture, plus an offset'),
  z
    .object({ type: z.literal('between'), a: FaceRef, b: FaceRef, t: z.number().min(0).max(1), offset: z.number() })
    .describe('Proportional between two faces: a + t·(b − a) + offset. A centered divider uses t = 0.5'),
])
export type Position = z.infer<typeof Position>

export const Extent = z
  .object({ from: Position.nullable(), to: Position.nullable(), length: z.number().positive().nullable() })
  .describe('On the axes of the face, two of the three are set; on the normal axis only from or only to, because the length is the thickness')
export type Extent = z.infer<typeof Extent>

export const ROLES = [
  'side', 'bottom', 'top', 'shelf', 'divider', 'back', 'kick', 'apron',
  'door', 'drawer-front', 'drawer-side', 'drawer-bottom', 'brace', 'other',
] as const
export const Role = z.enum(ROLES)

/** Pieces made by the drawer macro: they bring their own joints and clearances. */
export const isDrawerPart = (p: { role: string }) => p.role.startsWith('drawer-')
export type Role = z.infer<typeof Role>

export const Grain = z.enum(['length', 'width', 'any']).describe('Grain direction relative to the long side of the face')
export const Load = z.enum(['none', 'light', 'medium', 'heavy']).describe('heavy = books')
export type Load = z.infer<typeof Load>
export const Edge = z.enum(['front', 'back', 'left', 'right', 'top', 'bottom'])
export const PieceConfidence = z.enum(['high', 'medium', 'low'])

export const PieceId = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')
  .refine((id) => id !== 'furniture', '"furniture" está reservado')

export const Piece = z.object({
  id: PieceId,
  name: z.string().min(1),
  role: Role,
  material: z.string().describe('Material catalog id, for example "T18"'),
  normal: Axis.describe('Thickness axis'),
  x: Extent,
  y: Extent,
  z: Extent,
  grain: Grain,
  load: Load,
  support: z.enum(['fixed', 'movable']),
  edges: z.array(Edge).describe('Edges with edge banding'),
  group: z.string().nullable(),
  confidence: PieceConfidence,
})
export type Piece = z.infer<typeof Piece>

export const JOINT_TYPES = [
  'butt-screw', 'pocket-screw', 'dowel', 'cam-lock', 'dado', 'rabbet', 'bracket',
  'glue-nail', 'shelf-pin', 'cup-hinge', 'drawer-slide',
] as const
export const JointType = z.enum(JOINT_TYPES)
export type JointType = z.infer<typeof JointType>

export const Joint = z.object({
  id: z.string().min(1),
  a: PieceId.describe('The piece being fastened; in butt-screw, the screw goes through it'),
  b: PieceId.describe('The piece that receives; in butt-screw, the screw goes into its edge'),
  type: JointType,
  glue: z.boolean(),
  depth: z.number().nonnegative().nullable().describe('Dado or rabbet: how many mm a goes into b'),
  hardware: z.array(z.object({ hardwareId: z.string(), count: z.number().int().positive().nullable() })),
})
export type Joint = z.infer<typeof Joint>

export const Dimensions = z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() })
export type Dimensions = z.infer<typeof Dimensions>

export const Design = z.object({
  schema: z.literal(1),
  name: z.string(),
  dimensions: Dimensions,
  wallAnchored: z.boolean(),
  pieces: z.array(Piece),
  joints: z.array(Joint),
  notes: z.string().max(1200).describe('What was seen in the photos and does not fit in the model, in Spanish'),
})
export type Design = z.infer<typeof Design>

export const DIMENSION_OF_AXIS: Record<Axis, keyof Dimensions> = { x: 'width', y: 'height', z: 'depth' }
/** Each dimension as the person names it, for messages. */
export const DIMENSION_LABEL: Record<keyof Dimensions, string> = { width: 'ancho', height: 'alto', depth: 'fondo' }
