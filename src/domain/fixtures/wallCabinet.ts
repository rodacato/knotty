import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Design, Piece } from '../diseno/schema'

const HOLGURA = 2
const ENTRE_PUERTAS = 3

const puerta = (lado: 'izq' | 'der'): Piece =>
  makePiece({
    id: `puerta-${lado}`,
    nombre: lado === 'izq' ? 'Puerta izquierda' : 'Puerta derecha',
    rol: 'puerta',
    material: 'T18',
    normal: 'z',
    x:
      lado === 'izq'
        ? extent(ref('mueble.x0', HOLGURA), partway('mueble.x0', 'mueble.x1', 0.5, -ENTRE_PUERTAS / 2))
        : extent(partway('mueble.x0', 'mueble.x1', 0.5, ENTRE_PUERTAS / 2), ref('mueble.x1', -HOLGURA)),
    y: extent(ref('mueble.y0', HOLGURA), ref('mueble.y1', -HOLGURA)),
    z: endAt(ref('mueble.z1')),
    cantos: ['frente', 'atras', 'izq', 'der', 'arriba', 'abajo'],
  })

export const exampleWallCabinet: Design = {
  esquema: 1,
  nombre: 'Alacena de pared',
  dimensiones: { ancho: 760, alto: 720, fondo: 320 },
  anclajeMuro: true,
  observaciones: 'Alacena para colgar con dos puertas sobrepuestas y un entrepaño ajustable.',
  piezas: [
    makePiece({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: 'TR6', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
    makePiece({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', material: 'T18', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), cantos: ['frente'] }),
    makePiece({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', material: 'T18', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), cantos: ['frente'] }),
    makePiece({ id: 'piso', nombre: 'Piso', rol: 'piso', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(ref('mueble.y0')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), carga: 'media', cantos: ['frente'] }),
    makePiece({ id: 'techo', nombre: 'Techo', rol: 'techo', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: endAt(ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('puerta-izq.z0')), cantos: ['frente'] }),
    makePiece({ id: 'entrepano', nombre: 'Entrepaño', rol: 'entrepano', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(partway('piso.y1', 'techo.y0', 0.5, -9)), z: extent(ref('trasera.z1'), ref('puerta-izq.z0', -5)), carga: 'media', apoyo: 'movil', cantos: ['frente'] }),
    puerta('izq'),
    puerta('der'),
  ],
  uniones: [
    ...['piso', 'techo'].flatMap((b) => ['lat-izq', 'lat-der'].map((lat) => makeJoint(`u-${b}-${lat}`, lat, b, 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]))),
    ...['lat-izq', 'lat-der', 'piso', 'techo'].map((b) => makeJoint(`u-trasera-${b}`, 'trasera', b, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
    ...['lat-izq', 'lat-der'].map((lat) => makeJoint(`u-entrepano-${lat}`, 'entrepano', lat, 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }])),
    makeJoint('u-puerta-izq', 'puerta-izq', 'lat-izq', 'bisagra-cazoleta', [{ herrajeId: 'bisagra-cazoleta-35-recta', cantidad: 2 }]),
    makeJoint('u-puerta-der', 'puerta-der', 'lat-der', 'bisagra-cazoleta', [{ herrajeId: 'bisagra-cazoleta-35-recta', cantidad: 2 }]),
  ],
}
