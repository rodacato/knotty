import { z } from 'zod'
import { FaceRef, Edge, Load, PieceConfidence, Position, Axis, Piece, PieceId, Role, Joint, Grain } from '../design/schema'

// All the expert can do to an existing design. Every field is always there (nullable when it does not apply) for strict output.
// Operation names and fields are what the expert writes and what versions save.

export const Operation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addPiece'), piece: Piece }),
  z.object({ op: z.literal('removePiece'), id: PieceId }).describe('Removes the piece and its joints; positions that referred to it become fixed in mm'),
  z.object({ op: z.literal('removeGroup'), group: z.string() }),
  z.object({ op: z.literal('duplicatePiece'), id: PieceId, newId: PieceId, name: z.string(), axis: Axis, at: Position }).describe('Copies the piece and its joints and places its smaller face at the position'),
  z.object({ op: z.literal('resize'), id: PieceId, axis: Axis, end: z.enum(['from', 'to']), at: Position }).describe('Moves one end; the other stays. Does not apply to the normal axis'),
  z.object({ op: z.literal('move'), id: PieceId, axis: Axis, at: Position }).describe('Places the smaller face at the position, keeping the length'),
  z.object({ op: z.literal('distribute'), ids: z.array(PieceId).min(1), axis: Axis, a: FaceRef, b: FaceRef }).describe('Spreads pieces with equal gaps between two faces, along their normal axis'),
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
    confidence: PieceConfidence.nullable().describe('"high" when the person or a photo confirms the piece'),
  }),
  z.object({ op: z.literal('addJoint'), joint: Joint }),
  z.object({ op: z.literal('changeJoint'), joint: Joint }).describe('Replaces the joint with the same id'),
  z.object({ op: z.literal('removeJoint'), id: z.string() }),
  z
    .object({ op: z.literal('resizeFurniture'), axis: Axis, value: z.number().positive(), rule: z.enum(['stretch', 'proportional']) })
    .describe('stretch: whatever refers to the furniture faces stretches or moves. proportional: also scales absolute positions'),
  z.object({ op: z.literal('setWallAnchored'), value: z.boolean() }),
  z
    .object({
      op: z.literal('addDrawer'),
      group: PieceId.describe('Drawer id, for example "drawer-1"; its pieces are called "drawer-1-front", "drawer-1-side-left"…'),
      name: z.string().describe('"Cajón 1"'),
      left: FaceRef.describe('x face on the left of the opening, for example "side-left.x1"'),
      right: FaceRef.describe('x face on the right of the opening, for example "side-right.x0"'),
      bottom: FaceRef.describe('y face at the bottom of the opening, for example "bottom.y1"'),
      top: FaceRef.describe('y face at the top of the opening, for example "shelf-1.y0"'),
      front: FaceRef.describe('z face the front sits flush with, usually "furniture.z1"'),
      back: FaceRef.describe('z face at the back of the opening, usually "back.z1"'),
      material: z.string().describe('Front and box, for example "T15"'),
      bottomMaterial: z.string().describe('Drawer bottom, for example "TR6"'),
    })
    .describe('Builds a complete drawer with an inset front and telescopic slides; the app picks the slide and works out the clearances'),
])
export type Operation = z.infer<typeof Operation>
