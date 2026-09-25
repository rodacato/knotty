import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../design/builders'
import type { Design } from '../design/schema'

const DOOR_GAP = 3

export const exampleNightstand: Design = {
  schema: 1,
  name: 'Buró',
  dimensions: { width: 450, height: 550, depth: 400 },
  wallAnchored: false,
  kind: 'nightstand',
  notes: 'Buró con una puerta sobrepuesta, cubierta que tapa los laterales y un entrepaño fijo.',
  pieces: [
    makePiece({ id: 'back', name: 'Trasera', role: 'back', material: 'TR3', normal: 'z', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('furniture.y1')), z: startAt(ref('furniture.z0')) }),
    makePiece({ id: 'top', name: 'Cubierta', role: 'top', material: 'T18', normal: 'y', x: extent(ref('furniture.x0'), ref('furniture.x1')), y: endAt(ref('furniture.y1')), z: extent(ref('back.z1'), ref('furniture.z1')), edges: ['front', 'left', 'right'] }),
    makePiece({ id: 'side-left', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('furniture.x0')), y: extent(ref('furniture.y0'), ref('top.y0')), z: extent(ref('back.z1'), ref('door.z0')), edges: ['front'] }),
    makePiece({ id: 'side-right', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('furniture.x1')), y: extent(ref('furniture.y0'), ref('top.y0')), z: extent(ref('back.z1'), ref('door.z0')), edges: ['front'] }),
    makePiece({ id: 'bottom', name: 'Piso', role: 'bottom', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(ref('furniture.y0')), z: extent(ref('back.z1'), ref('door.z0')), load: 'medium' }),
    makePiece({ id: 'shelf', name: 'Entrepaño', role: 'shelf', material: 'T18', normal: 'y', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: startAt(partway('bottom.y1', 'top.y0', 0.5, -9)), z: extent(ref('back.z1'), ref('door.z0', -5)), load: 'medium', edges: ['front'] }),
    makePiece({ id: 'door', name: 'Puerta', role: 'door', material: 'T18', normal: 'z', x: extent(ref('furniture.x0', DOOR_GAP), ref('furniture.x1', -DOOR_GAP)), y: extent(ref('furniture.y0', DOOR_GAP), ref('top.y0', -DOOR_GAP)), z: endAt(ref('furniture.z1')), grain: 'length', edges: ['front', 'back', 'left', 'right', 'top', 'bottom'] }),
  ],
  joints: [
    makeJoint('j-top-left', 'top', 'side-left', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-top-right', 'top', 'side-right', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-bottom-left', 'side-left', 'bottom', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-bottom-right', 'side-right', 'bottom', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('j-shelf-left', 'shelf', 'side-left', 'dowel', [{ hardwareId: 'dowel-8x40', count: 3 }]),
    makeJoint('j-shelf-right', 'shelf', 'side-right', 'dowel', [{ hardwareId: 'dowel-8x40', count: 3 }]),
    ...['side-left', 'side-right', 'bottom', 'top', 'shelf'].map((b) => makeJoint(`j-back-${b}`, 'back', b, 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }])),
    makeJoint('j-door', 'door', 'side-left', 'cup-hinge', [{ hardwareId: 'cup-hinge-35-full', count: 2 }]),
  ],
}
