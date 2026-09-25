import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Design } from '../diseno/schema'

const HOLGURA_PUERTA = 3

export const exampleNightstand: Design = {
  schema: 1,
  name: 'Buró',
  dimensions: { width: 450, height: 550, depth: 400 },
  wallAnchored: false,
  notes: 'Buró con una puerta sobrepuesta, cubierta que tapa los laterales y un entrepaño fijo.',
  pieces: [
    makePiece({ id: 'trasera', name: 'Trasera', role: 'back', material: 'TR3', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
    makePiece({ id: 'techo', name: 'Cubierta', role: 'top', material: 'T18', normal: 'y', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: endAt(ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), edges: ['front', 'left', 'right'] }),
    makePiece({ id: 'lat-izq', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('techo.y0')), z: extent(ref('trasera.z1'), ref('puerta.z0')), edges: ['front'] }),
    makePiece({ id: 'lat-der', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('techo.y0')), z: extent(ref('trasera.z1'), ref('puerta.z0')), edges: ['front'] }),
    makePiece({ id: 'piso', name: 'Piso', role: 'bottom', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(ref('mueble.y0')), z: extent(ref('trasera.z1'), ref('puerta.z0')), load: 'medium' }),
    makePiece({ id: 'entrepano', name: 'Entrepaño', role: 'shelf', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(partway('piso.y1', 'techo.y0', 0.5, -9)), z: extent(ref('trasera.z1'), ref('puerta.z0', -5)), load: 'medium', edges: ['front'] }),
    makePiece({ id: 'puerta', name: 'Puerta', role: 'door', material: 'T18', normal: 'z', x: extent(ref('mueble.x0', HOLGURA_PUERTA), ref('mueble.x1', -HOLGURA_PUERTA)), y: extent(ref('mueble.y0', HOLGURA_PUERTA), ref('techo.y0', -HOLGURA_PUERTA)), z: endAt(ref('mueble.z1')), grain: 'length', edges: ['front', 'back', 'left', 'right', 'top', 'bottom'] }),
  ],
  joints: [
    makeJoint('u-techo-izq', 'techo', 'lat-izq', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-techo-der', 'techo', 'lat-der', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-piso-izq', 'lat-izq', 'piso', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-piso-der', 'lat-der', 'piso', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-entrepano-izq', 'entrepano', 'lat-izq', 'dowel', [{ hardwareId: 'dowel-8x40', count: 3 }]),
    makeJoint('u-entrepano-der', 'entrepano', 'lat-der', 'dowel', [{ hardwareId: 'dowel-8x40', count: 3 }]),
    ...['lat-izq', 'lat-der', 'piso', 'techo', 'entrepano'].map((b) => makeJoint(`u-trasera-${b}`, 'trasera', b, 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }])),
    makeJoint('u-puerta', 'puerta', 'lat-izq', 'cup-hinge', [{ hardwareId: 'cup-hinge-35-full', count: 2 }]),
  ],
}
