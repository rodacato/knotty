import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Design, Piece } from '../diseno/schema'

const HOLGURA = 2
const ENTRE_PUERTAS = 3

const puerta = (lado: 'izq' | 'der'): Piece =>
  makePiece({
    id: `puerta-${lado}`,
    name: lado === 'izq' ? 'Puerta izquierda' : 'Puerta derecha',
    role: 'door',
    material: 'T18',
    normal: 'z',
    x:
      lado === 'izq'
        ? extent(ref('mueble.x0', HOLGURA), partway('mueble.x0', 'mueble.x1', 0.5, -ENTRE_PUERTAS / 2))
        : extent(partway('mueble.x0', 'mueble.x1', 0.5, ENTRE_PUERTAS / 2), ref('mueble.x1', -HOLGURA)),
    y: extent(ref('mueble.y0', HOLGURA), ref('mueble.y1', -HOLGURA)),
    z: endAt(ref('mueble.z1')),
    edges: ['front', 'back', 'left', 'right', 'top', 'bottom'],
  })

export const exampleWallCabinet: Design = {
  schema: 1,
  name: 'Alacena de pared',
  dimensions: { width: 760, height: 720, depth: 320 },
  wallAnchored: true,
  notes: 'Alacena para colgar con dos puertas sobrepuestas y un entrepaño ajustable.',
  pieces: [
    makePiece({ id: 'trasera', name: 'Trasera', role: 'back', material: 'TR6', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
    makePiece({ id: 'lat-izq', name: 'Lateral izquierdo', role: 'side', material: 'T18', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), edges: ['front'] }),
    makePiece({ id: 'lat-der', name: 'Lateral derecho', role: 'side', material: 'T18', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), edges: ['front'] }),
    makePiece({ id: 'piso', name: 'Piso', role: 'bottom', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(ref('mueble.y0')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), load: 'medium', edges: ['front'] }),
    makePiece({ id: 'techo', name: 'Techo', role: 'top', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: endAt(ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), edges: ['front'] }),
    makePiece({ id: 'entrepano', name: 'Entrepaño', role: 'shelf', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(partway('piso.y1', 'techo.y0', 0.5, -9)), z: extent(ref('trasera.z1'), ref('puerta-izq.z0', -5)), load: 'medium', support: 'movable', edges: ['front'] }),
    puerta('izq'),
    puerta('der'),
  ],
  joints: [
    ...['piso', 'techo'].flatMap((b) => ['lat-izq', 'lat-der'].map((lat) => makeJoint(`u-${b}-${lat}`, lat, b, 'butt-screw', [{ hardwareId: 'tornillo-8x2', count: null }]))),
    ...['lat-izq', 'lat-der', 'piso', 'techo'].map((b) => makeJoint(`u-trasera-${b}`, 'trasera', b, 'glue-nail', [{ hardwareId: 'clavo-sin-cabeza-1', count: null }])),
    ...['lat-izq', 'lat-der'].map((lat) => makeJoint(`u-entrepano-${lat}`, 'entrepano', lat, 'shelf-pin', [{ hardwareId: 'soporte-repisa-5', count: 2 }])),
    makeJoint('u-puerta-izq', 'puerta-izq', 'lat-izq', 'cup-hinge', [{ hardwareId: 'bisagra-cazoleta-35-recta', count: 2 }]),
    makeJoint('u-puerta-der', 'puerta-der', 'lat-der', 'cup-hinge', [{ hardwareId: 'bisagra-cazoleta-35-recta', count: 2 }]),
  ],
}
