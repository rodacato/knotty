import { z } from 'zod'
import { FaceRef, Edge, Load, PieceConfidence, Position, Axis, Piece, PieceId, Role, Joint, Grain } from '../diseno/schema'

// All the expert can do to an existing design. Every field is always there (nullable when it does not apply) for strict output.
// Operation names and fields are what the expert writes: they stay in Spanish until the data moves to English (step 9).

export const Operation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('agregarPieza'), pieza: Piece }),
  z.object({ op: z.literal('eliminarPieza'), id: PieceId }).describe('Quita la pieza y sus uniones; las cotas que la referían quedan fijas en mm'),
  z.object({ op: z.literal('eliminarGrupo'), grupo: z.string() }),
  z.object({ op: z.literal('duplicarPieza'), id: PieceId, nuevoId: PieceId, nombre: z.string(), eje: Axis, cota: Position }).describe('Copia la pieza y sus uniones y la coloca con su cara menor en la cota'),
  z.object({ op: z.literal('redimensionar'), id: PieceId, eje: Axis, extremo: z.enum(['desde', 'hasta']), cota: Position }).describe('Mueve un extremo; el otro se queda. No aplica al eje normal'),
  z.object({ op: z.literal('mover'), id: PieceId, eje: Axis, cota: Position }).describe('Coloca la cara menor en la cota conservando el largo'),
  z.object({ op: z.literal('distribuir'), ids: z.array(PieceId).min(1), eje: Axis, a: FaceRef, b: FaceRef }).describe('Reparte piezas con huecos iguales entre dos caras, en su eje normal'),
  z.object({ op: z.literal('cambiarEspesor'), ids: z.array(PieceId).min(1), material: z.string() }),
  z.object({
    op: z.literal('cambiarPropiedades'),
    id: PieceId,
    nombre: z.string().nullable(),
    rol: Role.nullable(),
    veta: Grain.nullable(),
    carga: Load.nullable(),
    apoyo: z.enum(['fijo', 'movil']).nullable(),
    cantos: z.array(Edge).nullable(),
    confianza: PieceConfidence.nullable().describe('"alta" cuando la persona o una foto confirman la pieza'),
  }),
  z.object({ op: z.literal('agregarUnion'), union: Joint }),
  z.object({ op: z.literal('cambiarUnion'), union: Joint }).describe('Reemplaza la unión con el mismo id'),
  z.object({ op: z.literal('eliminarUnion'), id: z.string() }),
  z
    .object({ op: z.literal('cambiarDimensionGlobal'), eje: Axis, valor: z.number().positive(), regla: z.enum(['estirar', 'proporcional']) })
    .describe('estirar: lo referido a las caras del mueble se estira o se recorre. proporcional: además escala las cotas absolutas'),
  z.object({ op: z.literal('cambiarAnclajeMuro'), valor: z.boolean() }),
  z
    .object({
      op: z.literal('agregarCajon'),
      grupo: PieceId.describe('Id del cajón, por ejemplo "cajon-1"; sus piezas se llaman "cajon-1-frente", "cajon-1-costado-izq"…'),
      nombre: z.string().describe('"Cajón 1"'),
      izquierda: FaceRef.describe('Cara x del hueco a la izquierda, por ejemplo "lat-izq.x1"'),
      derecha: FaceRef.describe('Cara x del hueco a la derecha, por ejemplo "lat-der.x0"'),
      abajo: FaceRef.describe('Cara y del hueco abajo, por ejemplo "piso.y1"'),
      arriba: FaceRef.describe('Cara y del hueco arriba, por ejemplo "entrepano-1.y0"'),
      frente: FaceRef.describe('Cara z con la que queda al ras el frente, normalmente "mueble.z1"'),
      fondo: FaceRef.describe('Cara z del fondo del hueco, normalmente "trasera.z1"'),
      material: z.string().describe('Frente y caja, por ejemplo "T15"'),
      materialFondo: z.string().describe('Fondo del cajón, por ejemplo "TR6"'),
    })
    .describe('Arma un cajón completo con frente embutido y correderas telescópicas; la app elige la corredera y calcula las holguras'),
])
export type Operation = z.infer<typeof Operation>
