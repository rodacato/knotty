import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Design } from '../diseno/schema'

const ENTREPANOS = 4
const ESPESOR = 18

const entrepanos = Array.from({ length: ENTREPANOS }, (_, i) =>
  makePiece({
    id: `entrepano-${i + 1}`,
    nombre: `Entrepaño ${i + 1}`,
    rol: 'entrepano',
    material: 'T18',
    normal: 'y',
    x: extent(ref('lat-izq.x1'), ref('lat-der.x0')),
    y: startAt(partway('piso.y1', 'techo.y0', (i + 1) / (ENTREPANOS + 1), (ESPESOR * (i - ENTREPANOS)) / (ENTREPANOS + 1))),
    z: extent(ref('trasera.z1'), ref('mueble.z1')),
    carga: 'pesada',
    apoyo: 'movil',
    cantos: ['frente'],
  }),
)

export const exampleBookcase: Design = {
  esquema: 1,
  nombre: 'Librero',
  dimensiones: { ancho: 600, alto: 1800, fondo: 300 },
  anclajeMuro: true,
  observaciones: 'Librero sencillo de triplay de pino, sin puertas, con zoclo al frente y trasera clavada.',
  piezas: [
    makePiece({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: 'TR6', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
    makePiece({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', material: 'T18', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente'] }),
    makePiece({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', material: 'T18', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente'] }),
    makePiece({ id: 'zoclo', nombre: 'Zoclo', rol: 'zoclo', material: 'T18', normal: 'z', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: extent(ref('mueble.y0'), null, 70), z: endAt(ref('mueble.z1', -30)), veta: 'largo' }),
    makePiece({ id: 'piso', nombre: 'Piso', rol: 'piso', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(ref('zoclo.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), carga: 'pesada', cantos: ['frente'] }),
    makePiece({ id: 'techo', nombre: 'Techo', rol: 'techo', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: endAt(ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente'] }),
    ...entrepanos,
  ],
  uniones: [
    makeJoint('u-piso-izq', 'lat-izq', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-piso-der', 'lat-der', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-techo-izq', 'lat-izq', 'techo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-techo-der', 'lat-der', 'techo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-zoclo-izq', 'zoclo', 'lat-izq', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]),
    makeJoint('u-zoclo-der', 'zoclo', 'lat-der', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]),
    makeJoint('u-zoclo-piso', 'piso', 'zoclo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    ...['lat-izq', 'lat-der', 'piso', 'techo'].map((b) => makeJoint(`u-trasera-${b}`, 'trasera', b, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
    ...entrepanos.flatMap((e) =>
      ['lat-izq', 'lat-der'].map((lat) => makeJoint(`u-${e.id}-${lat}`, e.id, lat, 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }])),
    ),
  ],
}
