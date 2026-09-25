import { startAt, partway, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { Diseno } from '../diseno/esquema'

const HOLGURA_PUERTA = 3

export const buro: Diseno = {
  esquema: 1,
  nombre: 'Buró',
  dimensiones: { ancho: 450, alto: 550, fondo: 400 },
  anclajeMuro: false,
  observaciones: 'Buró con una puerta sobrepuesta, cubierta que tapa los laterales y un entrepaño fijo.',
  piezas: [
    makePiece({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: 'TR3', normal: 'z', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('mueble.y1')), z: startAt(ref('mueble.z0')) }),
    makePiece({ id: 'techo', nombre: 'Cubierta', rol: 'techo', material: 'T18', normal: 'y', x: extent(ref('mueble.x0'), ref('mueble.x1')), y: endAt(ref('mueble.y1')), z: extent(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente', 'izq', 'der'] }),
    makePiece({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', material: 'T18', normal: 'x', x: startAt(ref('mueble.x0')), y: extent(ref('mueble.y0'), ref('techo.y0')), z: extent(ref('trasera.z1'), ref('puerta.z0')), cantos: ['frente'] }),
    makePiece({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', material: 'T18', normal: 'x', x: endAt(ref('mueble.x1')), y: extent(ref('mueble.y0'), ref('techo.y0')), z: extent(ref('trasera.z1'), ref('puerta.z0')), cantos: ['frente'] }),
    makePiece({ id: 'piso', nombre: 'Piso', rol: 'piso', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(ref('mueble.y0')), z: extent(ref('trasera.z1'), ref('puerta.z0')), carga: 'media' }),
    makePiece({ id: 'entrepano', nombre: 'Entrepaño', rol: 'entrepano', material: 'T18', normal: 'y', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: startAt(partway('piso.y1', 'techo.y0', 0.5, -9)), z: extent(ref('trasera.z1'), ref('puerta.z0', -5)), carga: 'media', cantos: ['frente'] }),
    makePiece({ id: 'puerta', nombre: 'Puerta', rol: 'puerta', material: 'T18', normal: 'z', x: extent(ref('mueble.x0', HOLGURA_PUERTA), ref('mueble.x1', -HOLGURA_PUERTA)), y: extent(ref('mueble.y0', HOLGURA_PUERTA), ref('techo.y0', -HOLGURA_PUERTA)), z: endAt(ref('mueble.z1')), veta: 'largo', cantos: ['frente', 'atras', 'izq', 'der', 'arriba', 'abajo'] }),
  ],
  uniones: [
    makeJoint('u-techo-izq', 'techo', 'lat-izq', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-techo-der', 'techo', 'lat-der', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-piso-izq', 'lat-izq', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-piso-der', 'lat-der', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    makeJoint('u-entrepano-izq', 'entrepano', 'lat-izq', 'tarugo', [{ herrajeId: 'tarugo-8x40', cantidad: 3 }]),
    makeJoint('u-entrepano-der', 'entrepano', 'lat-der', 'tarugo', [{ herrajeId: 'tarugo-8x40', cantidad: 3 }]),
    ...['lat-izq', 'lat-der', 'piso', 'techo', 'entrepano'].map((b) => makeJoint(`u-trasera-${b}`, 'trasera', b, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
    makeJoint('u-puerta', 'puerta', 'lat-izq', 'bisagra-cazoleta', [{ herrajeId: 'bisagra-cazoleta-35-recta', cantidad: 2 }]),
  ],
}
