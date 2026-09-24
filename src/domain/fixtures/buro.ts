import { desde, entre, hasta, pieza, ref, tramo, union } from '../diseno/construir'
import type { Diseno } from '../diseno/esquema'

const HOLGURA_PUERTA = 3

export const buro: Diseno = {
  esquema: 1,
  nombre: 'Buró',
  dimensiones: { ancho: 450, alto: 550, fondo: 400 },
  anclajeMuro: false,
  observaciones: 'Buró con una puerta sobrepuesta, cubierta que tapa los laterales y un entrepaño fijo.',
  piezas: [
    pieza({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: 'TR3', normal: 'z', x: tramo(ref('mueble.x0'), ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: desde(ref('mueble.z0')) }),
    pieza({ id: 'techo', nombre: 'Cubierta', rol: 'techo', material: 'T18', normal: 'y', x: tramo(ref('mueble.x0'), ref('mueble.x1')), y: hasta(ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente', 'izq', 'der'] }),
    pieza({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', material: 'T18', normal: 'x', x: desde(ref('mueble.x0')), y: tramo(ref('mueble.y0'), ref('techo.y0')), z: tramo(ref('trasera.z1'), ref('puerta.z0')), cantos: ['frente'] }),
    pieza({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', material: 'T18', normal: 'x', x: hasta(ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('techo.y0')), z: tramo(ref('trasera.z1'), ref('puerta.z0')), cantos: ['frente'] }),
    pieza({ id: 'piso', nombre: 'Piso', rol: 'piso', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: desde(ref('mueble.y0')), z: tramo(ref('trasera.z1'), ref('puerta.z0')), carga: 'media' }),
    pieza({ id: 'entrepano', nombre: 'Entrepaño', rol: 'entrepano', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: desde(entre('piso.y1', 'techo.y0', 0.5, -9)), z: tramo(ref('trasera.z1'), ref('puerta.z0', -5)), carga: 'media', cantos: ['frente'] }),
    pieza({ id: 'puerta', nombre: 'Puerta', rol: 'puerta', material: 'T18', normal: 'z', x: tramo(ref('mueble.x0', HOLGURA_PUERTA), ref('mueble.x1', -HOLGURA_PUERTA)), y: tramo(ref('mueble.y0', HOLGURA_PUERTA), ref('techo.y0', -HOLGURA_PUERTA)), z: hasta(ref('mueble.z1')), veta: 'largo', cantos: ['frente', 'atras', 'izq', 'der', 'arriba', 'abajo'] }),
  ],
  uniones: [
    union('u-techo-izq', 'techo', 'lat-izq', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-techo-der', 'techo', 'lat-der', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-piso-izq', 'lat-izq', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-piso-der', 'lat-der', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-entrepano-izq', 'entrepano', 'lat-izq', 'tarugo', [{ herrajeId: 'tarugo-8x40', cantidad: 3 }]),
    union('u-entrepano-der', 'entrepano', 'lat-der', 'tarugo', [{ herrajeId: 'tarugo-8x40', cantidad: 3 }]),
    ...['lat-izq', 'lat-der', 'piso', 'techo', 'entrepano'].map((b) => union(`u-trasera-${b}`, 'trasera', b, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
    union('u-puerta', 'puerta', 'lat-izq', 'bisagra-cazoleta', [{ herrajeId: 'bisagra-cazoleta-35-recta', cantidad: 2 }]),
  ],
}
