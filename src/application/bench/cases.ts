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
    measures: { height: 1800, width: 800, depth: 300 },
    expected: { height: [1800, 1800], width: [800, 800], depth: [300, 300] },
  },
  {
    id: 'cama-cajones',
    notes:
      'Quiero una cama individual con una base con cajones 3, y una cabecera como librero para poner cosas con un espacio cerrado donde va la almohada pero despues con 2 entrepaños como librero',
    measures: null,
    expected: { width: [990, 1150], depth: [1900, 2200], height: [700, 1400] },
    anyOrientation: true,
  },
  {
    id: 'buro',
    notes: 'Buró con un cajón arriba y una repisa abierta abajo',
    measures: null,
    expected: { height: [450, 700], width: [350, 600], depth: [300, 500] },
  },
  {
    id: 'cama',
    notes: 'Cama individual con cabecera, para un colchón estándar',
    measures: null,
    // A single mattress is 990 × 1900 mm: pieces-wise the depth is the bed's length.
    expected: { width: [990, 1150], depth: [1900, 2100], height: [250, 1200] },
    anyOrientation: true,
  },
  {
    id: 'alacena',
    notes: 'Alacena de pared con dos puertas y una repisa en medio, para platos',
    measures: { height: 700, width: 800, depth: 300 },
    expected: { height: [700, 700], width: [800, 800], depth: [300, 300] },
  },
  {
    id: 'escritorio',
    notes: 'Escritorio sencillo con una repisa a un lado para la impresora',
    measures: null,
    expected: { height: [700, 780], width: [900, 1600], depth: [450, 750] },
  },
  {
    id: 'zapatera',
    notes: 'Zapatera para 12 pares, con repisas fijas y sin puertas',
    measures: { height: 900, width: 800, depth: 350 },
    expected: { height: [900, 900], width: [800, 800], depth: [350, 350] },
  },
  {
    id: 'mueble-tv',
    notes: 'Mueble bajo para TV de 1.6 m de largo, con dos puertas a los lados y un hueco abierto en medio para el decodificador',
    measures: null,
    expected: { width: [1500, 1700], height: [350, 650], depth: [300, 500] },
  },
  {
    id: 'mesa-centro',
    notes: 'Mesa de centro con un entrepaño abajo para revistas',
    measures: null,
    expected: { height: [350, 500], width: [700, 1300], depth: [400, 800] },
  },
]
