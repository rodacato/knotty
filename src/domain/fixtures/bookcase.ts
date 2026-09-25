import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Design } from '../diseno/schema'

const ENTREPANOS = 4
const ESPESOR = 18

const entrepanos = Array.from({ length: ENTREPANOS }, (_, i) =>
  makePiece({
    id: `entrepano-${i + 1}`,
    name: `Entrepaño ${i + 1}`,
    role: 'shelf',
    material: 'T18',
    normal: 'y',
    x: extent(ref('lat-izq.x1'), ref('lat-der.x0')),
    y: startAt(partway('piso.y1', 'techo.y0', (i + 1) / (ENTREPANOS + 1), (ESPESOR * (i - ENTREPANOS)) / (ENTREPANOS + 1))),
    z: extent(ref('trasera.z1'), ref('mueble.z1')),
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
    makePiece({ id: 'trasera', name: 'Trasera', role: 'back', material: 'TR6', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
    makePiece({ id: 'lat-izq', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), edges: ['front'] }),
    makePiece({ id: 'lat-der', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), edges: ['front'] }),
    makePiece({ id: 'zoclo', name: 'Zoclo', role: 'kick', material: 'T18', normal: 'z', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: extent(ref('mueble.y0'), null, 70), z: endAt(ref('mueble.z1', -30)), grain: 'length' }),
    makePiece({ id: 'piso', name: 'Piso', role: 'bottom', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(ref('zoclo.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), load: 'heavy', edges: ['front'] }),
    makePiece({ id: 'techo', name: 'Techo', role: 'top', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: endAt(ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), edges: ['front'] }),
    ...entrepanos,
  ],
  joints: [
    makeJoint('u-piso-izq', 'lat-izq', 'piso', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-piso-der', 'lat-der', 'piso', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-techo-izq', 'lat-izq', 'techo', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-techo-der', 'lat-der', 'techo', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    makeJoint('u-zoclo-izq', 'zoclo', 'lat-izq', 'pocket-screw', [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }]),
    makeJoint('u-zoclo-der', 'zoclo', 'lat-der', 'pocket-screw', [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }]),
    makeJoint('u-zoclo-piso', 'piso', 'zoclo', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]),
    ...['lat-izq', 'lat-der', 'piso', 'techo'].map((b) => makeJoint(`u-trasera-${b}`, 'trasera', b, 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }])),
    ...entrepanos.flatMap((e) =>
      ['lat-izq', 'lat-der'].map((lat) => makeJoint(`u-${e.id}-${lat}`, e.id, lat, 'shelf-pin', [{ hardwareId: 'shelf-pin-5', count: 2 }])),
    ),
  ],
}
