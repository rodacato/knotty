import type { Dimensions } from '../../domain/diseno/schema'

// Fixed requests to try an expert with: the same in the comparison script and in the hidden bench.
// `expected` holds sensible ranges in mm for each piece of furniture; outside them, the expert misread the request.

type Range = [number, number]

export interface BenchCase {
  id: string
  notes: string
  measures: Dimensions | null
  expected: Partial<Record<keyof Dimensions, Range>>
  /** A bed can lie either way: its ficha runs it along the width, a piece-by-piece design along the depth. */
  anyOrientation?: boolean
}

export const BENCH_CASES: BenchCase[] = [
  {
    id: 'librero',
    notes: 'Librero de 5 repisas para libros, sin puertas, con zoclo al frente; va pegado a la pared',
    measures: { alto: 1800, ancho: 800, fondo: 300 },
    expected: { alto: [1800, 1800], ancho: [800, 800], fondo: [300, 300] },
  },
  {
    id: 'cama-cajones',
    notes:
      'Quiero una cama individual con una base con cajones 3, y una cabecera como librero para poner cosas con un espacio cerrado donde va la almohada pero despues con 2 entrepaños como librero',
    measures: null,
    expected: { ancho: [990, 1150], fondo: [1900, 2200], alto: [700, 1400] },
    anyOrientation: true,
  },
  {
    id: 'buro',
    notes: 'Buró con un cajón arriba y una repisa abierta abajo',
    measures: null,
    expected: { alto: [450, 700], ancho: [350, 600], fondo: [300, 500] },
  },
  {
    id: 'cama',
    notes: 'Cama individual con cabecera, para un colchón estándar',
    measures: null,
    // A single mattress is 990 × 1900 mm: pieces-wise the depth is the bed's length.
    expected: { ancho: [990, 1150], fondo: [1900, 2100], alto: [250, 1200] },
    anyOrientation: true,
  },
  {
    id: 'alacena',
    notes: 'Alacena de pared con dos puertas y una repisa en medio, para platos',
    measures: { alto: 700, ancho: 800, fondo: 300 },
    expected: { alto: [700, 700], ancho: [800, 800], fondo: [300, 300] },
  },
  {
    id: 'escritorio',
    notes: 'Escritorio sencillo con una repisa a un lado para la impresora',
    measures: null,
    expected: { alto: [700, 780], ancho: [900, 1600], fondo: [450, 750] },
  },
  {
    id: 'zapatera',
    notes: 'Zapatera para 12 pares, con repisas fijas y sin puertas',
    measures: { alto: 900, ancho: 800, fondo: 350 },
    expected: { alto: [900, 900], ancho: [800, 800], fondo: [350, 350] },
  },
  {
    id: 'mueble-tv',
    notes: 'Mueble bajo para TV de 1.6 m de largo, con dos puertas a los lados y un hueco abierto en medio para el decodificador',
    measures: null,
    expected: { ancho: [1500, 1700], alto: [350, 650], fondo: [300, 500] },
  },
  {
    id: 'mesa-centro',
    notes: 'Mesa de centro con un entrepaño abajo para revistas',
    measures: null,
    expected: { alto: [350, 500], ancho: [700, 1300], fondo: [400, 800] },
  },
]
