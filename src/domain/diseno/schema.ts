import { z } from 'zod'

// Axes: X = width, Y = height, Z = depth (back → front); origin at the bottom-left-back corner; everything in mm.
// Optional fields are `nullable`, so the same schema works as the models' strict output. Field names and descriptions are what the expert reads: Spanish until step 9.

export const AXES = ['x', 'y', 'z'] as const
export const Axis = z.enum(AXES)
export type Axis = z.infer<typeof Axis>

export const FaceRef = z
  .string()
  .regex(/^[a-z0-9-]+\.[xyz][01]$/, 'Formato "<pieza>.<eje><0|1>", por ejemplo "lat-izq.x1" o "mueble.y0"')
  .describe('Una cara: 0 = la menor, 1 = la mayor. "mueble" son las caras exteriores del mueble')
export type FaceRef = z.infer<typeof FaceRef>

export const Position = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('mm'), mm: z.number() }).describe('Posición absoluta desde el origen del mueble'),
  z.object({ tipo: z.literal('ref'), ref: FaceRef, mas: z.number() }).describe('Una cara de otra pieza o del mueble, más un desplazamiento'),
  z
    .object({ tipo: z.literal('entre'), a: FaceRef, b: FaceRef, t: z.number().min(0).max(1), mas: z.number() })
    .describe('Proporcional entre dos caras: a + t·(b − a) + mas. Un divisor al centro usa t = 0.5'),
])
export type Position = z.infer<typeof Position>

export const Extent = z
  .object({ desde: Position.nullable(), hasta: Position.nullable(), largo: z.number().positive().nullable() })
  .describe('En los ejes de la cara van dos de tres; en el eje normal solo desde o solo hasta, porque el largo es el espesor')
export type Extent = z.infer<typeof Extent>

export const ROLES = [
  'lateral', 'piso', 'techo', 'entrepano', 'divisor', 'trasera', 'zoclo', 'faja',
  'puerta', 'frente-cajon', 'costado-cajon', 'fondo-cajon', 'refuerzo', 'otro',
] as const
export const Role = z.enum(ROLES)

/** Pieces made by the drawer macro: they bring their own joints and clearances. */
export const isDrawerPart = (p: { rol: string }) => p.rol.endsWith('-cajon')
export type Role = z.infer<typeof Role>

export const Grain = z.enum(['largo', 'ancho', 'libre']).describe('Dirección de la veta respecto al lado largo de la cara')
export const Load = z.enum(['ninguna', 'ligera', 'media', 'pesada']).describe('pesada = libros')
export type Load = z.infer<typeof Load>
export const Edge = z.enum(['frente', 'atras', 'izq', 'der', 'arriba', 'abajo'])
export const PieceConfidence = z.enum(['alta', 'media', 'baja'])

export const PieceId = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')
  .refine((id) => id !== 'mueble', '"mueble" está reservado')

export const Piece = z.object({
  id: PieceId,
  nombre: z.string().min(1),
  rol: Role,
  material: z.string().describe('Id del catálogo de materiales, por ejemplo "T18"'),
  normal: Axis.describe('Eje del espesor'),
  x: Extent,
  y: Extent,
  z: Extent,
  veta: Grain,
  carga: Load,
  apoyo: z.enum(['fijo', 'movil']),
  cantos: z.array(Edge).describe('Cantos con cubrecanto'),
  grupo: z.string().nullable(),
  confianza: PieceConfidence,
})
export type Piece = z.infer<typeof Piece>

export const JOINT_TYPES = [
  'tope-tornillo', 'bolsillo', 'tarugo', 'minifix', 'canal', 'rebaje', 'escuadra',
  'clavo-pegamento', 'soporte-repisa', 'bisagra-cazoleta', 'corredera',
] as const
export const JointType = z.enum(JOINT_TYPES)
export type JointType = z.infer<typeof JointType>

export const Joint = z.object({
  id: z.string().min(1),
  a: PieceId.describe('La pieza que se fija; en tope-tornillo, el tornillo la atraviesa'),
  b: PieceId.describe('La pieza que recibe; en tope-tornillo, el tornillo entra por su canto'),
  tipo: JointType,
  pegamento: z.boolean(),
  penetracion: z.number().nonnegative().nullable().describe('Canal o rebaje: cuántos mm entra a en b'),
  herrajes: z.array(z.object({ herrajeId: z.string(), cantidad: z.number().int().positive().nullable() })),
})
export type Joint = z.infer<typeof Joint>

export const Dimensions = z.object({ ancho: z.number().positive(), alto: z.number().positive(), fondo: z.number().positive() })
export type Dimensions = z.infer<typeof Dimensions>

export const Design = z.object({
  esquema: z.literal(1),
  nombre: z.string(),
  dimensiones: Dimensions,
  anclajeMuro: z.boolean(),
  piezas: z.array(Piece),
  uniones: z.array(Joint),
  observaciones: z.string().max(1200).describe('Lo que se vio en las fotos y no cabe en el modelo'),
})
export type Design = z.infer<typeof Design>

export const DIMENSION_OF_AXIS: Record<Axis, keyof Dimensions> = { x: 'ancho', y: 'alto', z: 'fondo' }
