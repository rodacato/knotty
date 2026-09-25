import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../design/builders'
import type { Design } from '../design/schema'

const SHELVES = 4
const THICKNESS = 18

const shelves = Array.from({ length: SHELVES }, (_, i) =>
  makePiece({
    id: `shelf-${i + 1}`,
    name: `Entrepaño ${i + 1}`,
    role: 'shelf',
    material: 'T18',
    normal: 'y',
    x: extent(ref('side-left.x1'), ref('side-right.x0')),
    y: startAt(partway('bottom.y1', 'top.y0', (i + 1) / (SHELVES + 1), (THICKNESS * (i - SHELVES)) / (SHELVES + 1))),
    z: extent(ref('back.z1'), ref('furniture.z1')),
    load: 'heavy',
    support: 'movable',
    edges: ['front'],
  }),
)

export const exampleBookcase: Design = {
  schema: 1,
  name: 'Librero',
  dimensions: { width: 600, height: 1800, depth: 300 },
  wallAnchored: true,
  notes: 'Librero sencillo de triplay de pino, sin puertas, con zoclo al frente y trasera clavada.',
  pieces: [
    makePiece({ id: 'back', name: 'Trasera', role: 'back', material: 'TR6', normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: startAt(ref('furniture.z0')) }),
    makePiece({ id: 'side-left', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: extent(ref('back.z1'), ref('furniture.z1')), edges: ['front'] }),
    makePiece({ id: 'side-right', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: extent(ref('back.z1'), ref('furniture.z1')), edges: ['front'] }),
    makePiece({ id: 'kick', name: 'Zoclo', role: 'kick', material: 'T18', normal: 'z', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: extent(ref('furniture.y0'), null, 70), z: endAt(ref('furniture.z1', -30)), grain: 'length' }),
    makePiece({ id: 'bottom', name: 'Piso', role: 'bottom', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(ref('kick.y1')), z: extent(ref('back.z1'), ref('furniture.z1')), load: 'heavy', edges: ['front'] }),
    makePiece({ id: 'top', name: 'Techo', role: 'top', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: endAt(ref('furniture.y1')), z: extent(ref('back.z1'), ref('furniture.z1')), edges: ['front'] }),
    ...shelves,
  ],
  joints: [
    makeJoint('j-bottom-left', 'side-left', 'bottom', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-bottom-right', 'side-right', 'bottom', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-top-left', 'side-left', 'top', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-top-right', 'side-right', 'top', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-kick-left', 'kick', 'side-left', 'pocket-screw', [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }]),
    makeJoint('j-kick-right', 'kick', 'side-right', 'pocket-screw', [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }]),
    makeJoint('j-kick-bottom', 'bottom', 'kick', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    ...['side-left', 'side-right', 'bottom', 'top'].map((b) => makeJoint(`j-back-${b}`, 'back', b, 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }])),
    ...shelves.flatMap((shelf) =>
      ['side-left', 'side-right'].map((side) => makeJoint(`j-${shelf.id}-${side}`, shelf.id, side, 'shelf-pin', [{ hardwareId: 'shelf-pin-5', count: 2 }])),
    ),
  ],
}
