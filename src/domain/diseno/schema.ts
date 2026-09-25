import { z } from 'zod'

// Axes: X = width, Y = height, Z = depth (back → front); origin at the bottom-left-back corner; everything in mm.
// Optional fields are `nullable`, so the same schema works as the models' strict output. Field names are what the expert reads and what is saved; descriptions stay in Spanish until the prompts move to English.

export const AXES = ['x', 'y', 'z'] as const
export const Axis = z.enum(AXES)
export type Axis = z.infer<typeof Axis>

export const FaceRef = z
  .string()
  .regex(/^[a-z0-9-]+\.[xyz][01]$/, 'Formato "<pieza>.<eje><0|1>", por ejemplo "lat-izq.x1" o "mueble.y0"')
  .describe('Una cara: 0 = la menor, 1 = la mayor. "mueble" son las caras exteriores del mueble')
export type FaceRef = z.infer<typeof FaceRef>

export const Position = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mm'), mm: z.number() }).describe('Posición absoluta desde el origen del mueble'),
  z.object({ type: z.literal('ref'), ref: FaceRef, offset: z.number() }).describe('Una cara de otra pieza o del mueble, más un desplazamiento'),
  z
    .object({ type: z.literal('between'), a: FaceRef, b: FaceRef, t: z.number().min(0).max(1), offset: z.number() })
    .describe('Proporcional entre dos caras: a + t·(b − a) + offset. Un divisor al centro usa t = 0.5'),
])
export type Position = z.infer<typeof Position>

export const Extent = z
  .object({ from: Position.nullable(), to: Position.nullable(), length: z.number().positive().nullable() })
  .describe('En los ejes de la cara van dos de tres; en el eje normal solo from o solo to, porque el largo es el espesor')
export type Extent = z.infer<typeof Extent>

export const ROLES = [
  'side', 'bottom', 'top', 'shelf', 'divider', 'back', 'kick', 'apron',
  'door', 'drawer-front', 'drawer-side', 'drawer-bottom', 'brace', 'other',
] as const
export const Role = z.enum(ROLES)

/** Pieces made by the drawer macro: they bring their own joints and clearances. */
export const isDrawerPart = (p: { role: string }) => p.role.startsWith('drawer-')
export type Role = z.infer<typeof Role>

export const Grain = z.enum(['length', 'width', 'any']).describe('Dirección de la veta respecto al lado largo de la cara')
export const Load = z.enum(['none', 'light', 'medium', 'heavy']).describe('heavy = libros')
export type Load = z.infer<typeof Load>
export const Edge = z.enum(['front', 'back', 'left', 'right', 'top', 'bottom'])
export const PieceConfidence = z.enum(['high', 'medium', 'low'])

export const PieceId = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')
  .refine((id) => id !== 'mueble', '"mueble" está reservado')

export const Piece = z.object({
  id: PieceId,
  name: z.string().min(1),
  role: Role,
  material: z.string().describe('Id del catálogo de materiales, por ejemplo "T18"'),
  normal: Axis.describe('Eje del espesor'),
  x: Extent,
  y: Extent,
  z: Extent,
  grain: Grain,
  load: Load,
  support: z.enum(['fixed', 'movable']),
  edges: z.array(Edge).describe('Cantos con cubrecanto'),
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
  a: PieceId.describe('La pieza que se fija; en butt-screw, el tornillo la atraviesa'),
  b: PieceId.describe('La pieza que recibe; en butt-screw, el tornillo entra por su canto'),
  type: JointType,
  glue: z.boolean(),
  depth: z.number().nonnegative().nullable().describe('Canal o rebaje: cuántos mm entra a en b'),
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
  notes: z.string().max(1200).describe('Lo que se vio en las fotos y no cabe en el modelo'),
})
export type Design = z.infer<typeof Design>

export const DIMENSION_OF_AXIS: Record<Axis, keyof Dimensions> = { x: 'width', y: 'height', z: 'depth' }
/** Each dimension as the person names it, for messages. */
export const DIMENSION_LABEL: Record<keyof Dimensions, string> = { width: 'ancho', height: 'alto', depth: 'fondo' }
