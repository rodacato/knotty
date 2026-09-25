import { z } from 'zod'
import { FaceRef, Edge, Load, PieceConfidence, Position, Axis, Piece, PieceId, Role, Joint, Grain } from '../diseno/schema'

// All the expert can do to an existing design. Every field is always there (nullable when it does not apply) for strict output.
// Operation names and fields are what the expert writes and what versions save.

export const Operation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addPiece'), piece: Piece }),
  z.object({ op: z.literal('removePiece'), id: PieceId }).describe('Quita la pieza y sus uniones; las cotas que la referían quedan fijas en mm'),
  z.object({ op: z.literal('removeGroup'), group: z.string() }),
  z.object({ op: z.literal('duplicatePiece'), id: PieceId, newId: PieceId, name: z.string(), axis: Axis, at: Position }).describe('Copia la pieza y sus uniones y la coloca con su cara menor en la cota'),
  z.object({ op: z.literal('resize'), id: PieceId, axis: Axis, end: z.enum(['from', 'to']), at: Position }).describe('Mueve un extremo; el otro se queda. No aplica al eje normal'),
  z.object({ op: z.literal('move'), id: PieceId, axis: Axis, at: Position }).describe('Coloca la cara menor en la cota conservando el largo'),
  z.object({ op: z.literal('distribute'), ids: z.array(PieceId).min(1), axis: Axis, a: FaceRef, b: FaceRef }).describe('Reparte piezas con huecos iguales entre dos caras, en su eje normal'),
  z.object({ op: z.literal('changeMaterial'), ids: z.array(PieceId).min(1), material: z.string() }),
  z.object({
    op: z.literal('changeProperties'),
    id: PieceId,
    name: z.string().nullable(),
    role: Role.nullable(),
    grain: Grain.nullable(),
    load: Load.nullable(),
    support: z.enum(['fixed', 'movable']).nullable(),
    edges: z.array(Edge).nullable(),
    confidence: PieceConfidence.nullable().describe('"high" cuando la persona o una foto confirman la pieza'),
  }),
  z.object({ op: z.literal('addJoint'), joint: Joint }),
  z.object({ op: z.literal('changeJoint'), joint: Joint }).describe('Reemplaza la unión con el mismo id'),
  z.object({ op: z.literal('removeJoint'), id: z.string() }),
  z
    .object({ op: z.literal('resizeFurniture'), axis: Axis, value: z.number().positive(), rule: z.enum(['stretch', 'proportional']) })
    .describe('stretch: lo referido a las caras del mueble se estira o se recorre. proportional: además escala las cotas absolutas'),
  z.object({ op: z.literal('setWallAnchored'), value: z.boolean() }),
  z
    .object({
      op: z.literal('addDrawer'),
      group: PieceId.describe('Id del cajón, por ejemplo "cajon-1"; sus piezas se llaman "cajon-1-frente", "cajon-1-costado-izq"…'),
      name: z.string().describe('"Cajón 1"'),
      left: FaceRef.describe('Cara x del hueco a la izquierda, por ejemplo "lat-izq.x1"'),
      right: FaceRef.describe('Cara x del hueco a la derecha, por ejemplo "lat-der.x0"'),
      bottom: FaceRef.describe('Cara y del hueco abajo, por ejemplo "piso.y1"'),
      top: FaceRef.describe('Cara y del hueco arriba, por ejemplo "entrepano-1.y0"'),
      front: FaceRef.describe('Cara z con la que queda al ras el frente, normalmente "mueble.z1"'),
      back: FaceRef.describe('Cara z del fondo del hueco, normalmente "trasera.z1"'),
      material: z.string().describe('Frente y caja, por ejemplo "T15"'),
      bottomMaterial: z.string().describe('Fondo del cajón, por ejemplo "TR6"'),
    })
    .describe('Arma un cajón completo con frente embutido y correderas telescópicas; la app elige la corredera y calcula las holguras'),
])
export type Operation = z.infer<typeof Operation>
