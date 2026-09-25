import type { Dimensiones } from '../../src/domain/diseno/esquema'

// Pedidos fijos para comparar modelos. `esperado` son rangos razonables en mm para ese mueble; fuera de ellos, el modelo interpretó mal.

type Rango = [number, number]

export interface Caso {
  id: string
  notas: string
  medidas: Dimensiones | null
  esperado: Partial<Record<keyof Dimensiones, Rango>>
}

export const CASOS: Caso[] = [
  {
    id: 'librero',
    notas: 'Librero de 5 repisas para libros, sin puertas, con zoclo al frente; va pegado a la pared',
    medidas: { alto: 1800, ancho: 800, fondo: 300 },
    esperado: { alto: [1800, 1800], ancho: [800, 800], fondo: [300, 300] },
  },
  {
    id: 'buro',
    notas: 'Buró con un cajón arriba y una repisa abierta abajo',
    medidas: null,
    esperado: { alto: [450, 700], ancho: [350, 600], fondo: [300, 500] },
  },
  {
    id: 'cama',
    notas: 'Cama individual con cabecera, para un colchón estándar',
    medidas: null,
    // Colchón individual de 990 × 1900 mm: el fondo es el largo de la cama.
    esperado: { ancho: [990, 1150], fondo: [1900, 2100], alto: [250, 1200] },
  },
  {
    id: 'alacena',
    notas: 'Alacena de pared con dos puertas y una repisa en medio, para platos',
    medidas: { alto: 700, ancho: 800, fondo: 300 },
    esperado: { alto: [700, 700], ancho: [800, 800], fondo: [300, 300] },
  },
  {
    id: 'escritorio',
    notas: 'Escritorio sencillo con una repisa a un lado para la impresora',
    medidas: null,
    esperado: { alto: [700, 780], ancho: [900, 1600], fondo: [450, 750] },
  },
  {
    id: 'zapatera',
    notas: 'Zapatera para 12 pares, con repisas fijas y sin puertas',
    medidas: { alto: 900, ancho: 800, fondo: 350 },
    esperado: { alto: [900, 900], ancho: [800, 800], fondo: [350, 350] },
  },
  {
    id: 'mueble-tv',
    notas: 'Mueble bajo para TV de 1.6 m de largo, con dos puertas a los lados y un hueco abierto en medio para el decodificador',
    medidas: null,
    esperado: { ancho: [1500, 1700], alto: [350, 650], fondo: [300, 500] },
  },
  {
    id: 'mesa-centro',
    notas: 'Mesa de centro con un entrepaño abajo para revistas',
    medidas: null,
    esperado: { alto: [350, 500], ancho: [700, 1300], fondo: [400, 800] },
  },
]
