import { desde, entre, hasta, pieza, ref, tramo, union } from '../diseno/construir'
import type { Diseno, Pieza } from '../diseno/esquema'

const HOLGURA = 2
const ENTRE_PUERTAS = 3

const puerta = (lado: 'izq' | 'der'): Pieza =>
  pieza({
    id: `puerta-${lado}`,
    nombre: lado === 'izq' ? 'Puerta izquierda' : 'Puerta derecha',
    rol: 'puerta',
    material: 'T18',
    normal: 'z',
    x:
      lado === 'izq'
        ? tramo(ref('mueble.x0', HOLGURA), entre('mueble.x0', 'mueble.x1', 0.5, -ENTRE_PUERTAS / 2))
        : tramo(entre('mueble.x0', 'mueble.x1', 0.5, ENTRE_PUERTAS / 2), ref('mueble.x1', -HOLGURA)),
    y: tramo(ref('mueble.y0', HOLGURA), ref('mueble.y1', -HOLGURA)),
    z: hasta(ref('mueble.z1')),
    cantos: ['frente', 'atras', 'izq', 'der', 'arriba', 'abajo'],
  })

export const alacena: Diseno = {
  esquema: 1,
  nombre: 'Alacena de pared',
  dimensiones: { ancho: 800, alto: 720, fondo: 320 },
  anclajeMuro: true,
  observaciones: 'Alacena para colgar con dos puertas sobrepuestas y un entrepaño ajustable.',
  piezas: [
    pieza({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: 'TR6', normal: 'z', x: tramo(ref('mueble.x0'), ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: desde(ref('mueble.z0')) }),
    pieza({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', material: 'T18', normal: 'x', x: desde(ref('mueble.x0')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('puerta-izq.z0')), cantos: ['frente'] }),
    pieza({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', material: 'T18', normal: 'x', x: hasta(ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('puerta-izq.z0')), cantos: ['frente'] }),
    pieza({ id: 'piso', nombre: 'Piso', rol: 'piso', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: desde(ref('mueble.y0')), z: tramo(ref('trasera.z1'), ref('puerta-izq.z0')), carga: 'media', cantos: ['frente'] }),
    pieza({ id: 'techo', nombre: 'Techo', rol: 'techo', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: hasta(ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('puerta-izq.z0')), cantos: ['frente'] }),
    pieza({ id: 'entrepano', nombre: 'Entrepaño', rol: 'entrepano', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: desde(entre('piso.y1', 'techo.y0', 0.5, -9)), z: tramo(ref('trasera.z1'), ref('puerta-izq.z0', -5)), carga: 'media', apoyo: 'movil', cantos: ['frente'] }),
    puerta('izq'),
    puerta('der'),
  ],
  uniones: [
    ...['piso', 'techo'].flatMap((b) => ['lat-izq', 'lat-der'].map((lat) => union(`u-${b}-${lat}`, lat, b, 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]))),
    ...['lat-izq', 'lat-der', 'piso', 'techo'].map((b) => union(`u-trasera-${b}`, 'trasera', b, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
    ...['lat-izq', 'lat-der'].map((lat) => union(`u-entrepano-${lat}`, 'entrepano', lat, 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }])),
    union('u-puerta-izq', 'puerta-izq', 'lat-izq', 'bisagra-cazoleta', [{ herrajeId: 'bisagra-cazoleta-35-recta', cantidad: 2 }]),
    union('u-puerta-der', 'puerta-der', 'lat-der', 'bisagra-cazoleta', [{ herrajeId: 'bisagra-cazoleta-35-recta', cantidad: 2 }]),
  ],
}
