import { desde, entre, hasta, pieza, ref, tramo, union } from '../diseno/construir'
import type { Diseno } from '../diseno/esquema'

const ENTREPANOS = 4
const ESPESOR = 18

const entrepanos = Array.from({ length: ENTREPANOS }, (_, i) =>
  pieza({
    id: `entrepano-${i + 1}`,
    nombre: `Entrepaño ${i + 1}`,
    rol: 'entrepano',
    material: 'T18',
    normal: 'y',
    x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')),
    y: desde(entre('piso.y1', 'techo.y0', (i + 1) / (ENTREPANOS + 1), (ESPESOR * (i - ENTREPANOS)) / (ENTREPANOS + 1))),
    z: tramo(ref('trasera.z1'), ref('mueble.z1')),
    carga: 'pesada',
    apoyo: 'movil',
    cantos: ['frente'],
  }),
)

export const librero: Diseno = {
  esquema: 1,
  nombre: 'Librero',
  dimensiones: { ancho: 600, alto: 1800, fondo: 300 },
  anclajeMuro: true,
  observaciones: 'Librero sencillo de triplay de pino, sin puertas, con zoclo al frente y trasera clavada.',
  piezas: [
    pieza({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: 'TR6', normal: 'z', x: tramo(ref('mueble.x0'), ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: desde(ref('mueble.z0')) }),
    pieza({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', material: 'T18', normal: 'x', x: desde(ref('mueble.x0')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente'] }),
    pieza({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', material: 'T18', normal: 'x', x: hasta(ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente'] }),
    pieza({ id: 'zoclo', nombre: 'Zoclo', rol: 'zoclo', material: 'T18', normal: 'z', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: tramo(ref('mueble.y0'), null, 70), z: hasta(ref('mueble.z1', -30)), veta: 'largo' }),
    pieza({ id: 'piso', nombre: 'Piso', rol: 'piso', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: desde(ref('zoclo.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')), carga: 'pesada', cantos: ['frente'] }),
    pieza({ id: 'techo', nombre: 'Techo', rol: 'techo', material: 'T18', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: hasta(ref('mueble.y1')), z: tramo(ref('trasera.z1'), ref('mueble.z1')), cantos: ['frente'] }),
    ...entrepanos,
  ],
  uniones: [
    union('u-piso-izq', 'lat-izq', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-piso-der', 'lat-der', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-techo-izq', 'lat-izq', 'techo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-techo-der', 'lat-der', 'techo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    union('u-zoclo-izq', 'zoclo', 'lat-izq', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]),
    union('u-zoclo-der', 'zoclo', 'lat-der', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]),
    union('u-zoclo-piso', 'piso', 'zoclo', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]),
    ...['lat-izq', 'lat-der', 'piso', 'techo'].map((b) => union(`u-trasera-${b}`, 'trasera', b, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
    ...entrepanos.flatMap((e) =>
      ['lat-izq', 'lat-der'].map((lat) => union(`u-${e.id}-${lat}`, e.id, lat, 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }])),
    ),
  ],
}
