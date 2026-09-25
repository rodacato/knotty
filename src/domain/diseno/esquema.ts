import { z } from 'zod'

// Ejes: X = ancho, Y = alto, Z = fondo (trasera → frente); origen en la esquina inferior-izquierda-trasera; todo en mm.
// Opcionales como `nullable` para que el mismo esquema sirva de salida estricta de los LLM.

export const EJES = ['x', 'y', 'z'] as const
export const Eje = z.enum(EJES)
export type Eje = z.infer<typeof Eje>

export const CaraRef = z
  .string()
  .regex(/^[a-z0-9-]+\.[xyz][01]$/, 'Formato "<pieza>.<eje><0|1>", por ejemplo "lat-izq.x1" o "mueble.y0"')
  .describe('Una cara: 0 = la menor, 1 = la mayor. "mueble" son las caras exteriores del mueble')
export type CaraRef = z.infer<typeof CaraRef>

export const Cota = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('mm'), mm: z.number() }).describe('Posición absoluta desde el origen del mueble'),
  z.object({ tipo: z.literal('ref'), ref: CaraRef, mas: z.number() }).describe('Una cara de otra pieza o del mueble, más un desplazamiento'),
  z
    .object({ tipo: z.literal('entre'), a: CaraRef, b: CaraRef, t: z.number().min(0).max(1), mas: z.number() })
    .describe('Proporcional entre dos caras: a + t·(b − a) + mas. Un divisor al centro usa t = 0.5'),
])
export type Cota = z.infer<typeof Cota>

export const Tramo = z
  .object({ desde: Cota.nullable(), hasta: Cota.nullable(), largo: z.number().positive().nullable() })
  .describe('En los ejes de la cara van dos de tres; en el eje normal solo desde o solo hasta, porque el largo es el espesor')
export type Tramo = z.infer<typeof Tramo>

export const ROLES = [
  'lateral', 'piso', 'techo', 'entrepano', 'divisor', 'trasera', 'zoclo', 'faja',
  'puerta', 'frente-cajon', 'costado-cajon', 'fondo-cajon', 'refuerzo', 'otro',
] as const
export const Rol = z.enum(ROLES)

/** Pieces made by the drawer macro: they bring their own joints and clearances. */
export const isDrawerPart = (p: { rol: string }) => p.rol.endsWith('-cajon')
export type Rol = z.infer<typeof Rol>

export const Veta = z.enum(['largo', 'ancho', 'libre']).describe('Dirección de la veta respecto al lado largo de la cara')
export const Carga = z.enum(['ninguna', 'ligera', 'media', 'pesada']).describe('pesada = libros')
export type Carga = z.infer<typeof Carga>
export const Canto = z.enum(['frente', 'atras', 'izq', 'der', 'arriba', 'abajo'])
export const Confianza = z.enum(['alta', 'media', 'baja'])

export const PiezaId = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')
  .refine((id) => id !== 'mueble', '"mueble" está reservado')

export const Pieza = z.object({
  id: PiezaId,
  nombre: z.string().min(1),
  rol: Rol,
  material: z.string().describe('Id del catálogo de materiales, por ejemplo "T18"'),
  normal: Eje.describe('Eje del espesor'),
  x: Tramo,
  y: Tramo,
  z: Tramo,
  veta: Veta,
  carga: Carga,
  apoyo: z.enum(['fijo', 'movil']),
  cantos: z.array(Canto).describe('Cantos con cubrecanto'),
  grupo: z.string().nullable(),
  confianza: Confianza,
})
export type Pieza = z.infer<typeof Pieza>

export const TIPOS_UNION = [
  'tope-tornillo', 'bolsillo', 'tarugo', 'minifix', 'canal', 'rebaje', 'escuadra',
  'clavo-pegamento', 'soporte-repisa', 'bisagra-cazoleta', 'corredera',
] as const
export const TipoUnion = z.enum(TIPOS_UNION)
export type TipoUnion = z.infer<typeof TipoUnion>

export const Union = z.object({
  id: z.string().min(1),
  a: PiezaId.describe('La pieza que se fija; en tope-tornillo, el tornillo la atraviesa'),
  b: PiezaId.describe('La pieza que recibe; en tope-tornillo, el tornillo entra por su canto'),
  tipo: TipoUnion,
  pegamento: z.boolean(),
  penetracion: z.number().nonnegative().nullable().describe('Canal o rebaje: cuántos mm entra a en b'),
  herrajes: z.array(z.object({ herrajeId: z.string(), cantidad: z.number().int().positive().nullable() })),
})
export type Union = z.infer<typeof Union>

export const Dimensiones = z.object({ ancho: z.number().positive(), alto: z.number().positive(), fondo: z.number().positive() })
export type Dimensiones = z.infer<typeof Dimensiones>

export const Diseno = z.object({
  esquema: z.literal(1),
  nombre: z.string(),
  dimensiones: Dimensiones,
  anclajeMuro: z.boolean(),
  piezas: z.array(Pieza),
  uniones: z.array(Union),
  observaciones: z.string().max(1200).describe('Lo que se vio en las fotos y no cabe en el modelo'),
})
export type Diseno = z.infer<typeof Diseno>

export const DIMENSION_DE_EJE: Record<Eje, keyof Dimensiones> = { x: 'ancho', y: 'alto', z: 'fondo' }
