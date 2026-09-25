import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../design/builders'
import type { Design, Piece } from '../design/schema'

const GAP = 2
const BETWEEN_DOORS = 3

const door = (side: 'left' | 'right'): Piece =>
  makePiece({
    id: `door-${side}`,
    name: side === 'left' ? 'Puerta izquierda' : 'Puerta derecha',
    role: 'door',
    material: 'T18',
    normal: 'z',
    x:
      side === 'left'
        ? extent(ref('furniture.x0', GAP), partway('furniture.x0', 'furniture.x1', 0.5, -BETWEEN_DOORS / 2))
        : extent(partway('furniture.x0', 'furniture.x1', 0.5, BETWEEN_DOORS / 2), ref('furniture.x1', -GAP)),
    y: extent(ref('furniture.y0', GAP), ref('furniture.y1', -GAP)),
    z: endAt(ref('furniture.z1')),
    edges: ['front', 'back', 'left', 'right', 'top', 'bottom'],
  })

export const exampleWallCabinet: Design = {
  schema: 1,
  name: 'Alacena de pared',
  dimensions: { width: 760, height: 720, depth: 320 },
  wallAnchored: true,
  kind: 'wallCabinet',
  notes: 'Alacena para colgar con dos puertas sobrepuestas y un entrepaño ajustable.',
  pieces: [
    makePiece({ id: 'back', name: 'Trasera', role: 'back', material: 'TR6', normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: startAt(ref('furniture.z0')) }),
    makePiece({ id: 'side-left', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: extent(ref('back.z1'), ref('door-left.z0')), edges: ['front'] }),
    makePiece({ id: 'side-right', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: extent(ref('back.z1'), ref('door-left.z0')), edges: ['front'] }),
    makePiece({ id: 'bottom', name: 'Piso', role: 'bottom', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(ref('furniture.y0')), z: extent(ref('back.z1'), ref('door-left.z0')), load: 'medium', edges: ['front'] }),
    makePiece({ id: 'top', name: 'Techo', role: 'top', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: endAt(ref('furniture.y1')), z: extent(ref('back.z1'), ref('door-left.z0')), edges: ['front'] }),
    makePiece({ id: 'shelf', name: 'Entrepaño', role: 'shelf', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(partway('bottom.y1', 'top.y0', 0.5, -9)), z: extent(ref('back.z1'), ref('door-left.z0', -5)), load: 'medium', support: 'movable', edges: ['front'] }),
    door('left'),
    door('right'),
  ],
  joints: [
    ...['bottom', 'top'].flatMap((b) => ['side-left', 'side-right'].map((side) => makeJoint(`j-${b}-${side}`, side, b, 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]))),
    ...['side-left', 'side-right', 'bottom', 'top'].map((b) => makeJoint(`j-back-${b}`, 'back', b, 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }])),
    ...['side-left', 'side-right'].map((side) => makeJoint(`j-shelf-${side}`, 'shelf', side, 'shelf-pin', [{ hardwareId: 'shelf-pin-5', count: 2 }])),
    makeJoint('j-door-left', 'door-left', 'side-left', 'cup-hinge', [{ hardwareId: 'cup-hinge-35-full', count: 2 }]),
    makeJoint('j-door-right', 'door-right', 'side-right', 'cup-hinge', [{ hardwareId: 'cup-hinge-35-full', count: 2 }]),
  ],
}
