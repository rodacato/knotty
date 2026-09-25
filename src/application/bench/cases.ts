import type { Dimensions } from '../../domain/design/schema'

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
  /** How the request should be designed: a shape no ficha expresses must go piece by piece, and the other way is a misread. */
  path?: 'ficha' | 'pieces'
}

export const BENCH_CASES: BenchCase[] = [
  {
    id: 'bookcase',
    notes: 'Librero de 5 repisas para libros, sin puertas, con zoclo al frente; va pegado a la pared',
    measures: { height: 1800, width: 800, depth: 300 },
    expected: { height: [1800, 1800], width: [800, 800], depth: [300, 300] },
  },
  {
    id: 'bed-drawers',
    notes:
      'Quiero una cama individual con una base con cajones 3, y una cabecera como librero para poner cosas con un espacio cerrado donde va la almohada pero despues con 2 entrepaños como librero',
    measures: null,
    expected: { width: [990, 1150], depth: [1900, 2200], height: [700, 1400] },
    anyOrientation: true,
  },
  {
    id: 'nightstand',
    notes: 'Buró con un cajón arriba y una repisa abierta abajo',
    measures: null,
    expected: { height: [450, 700], width: [350, 600], depth: [300, 500] },
  },
  {
    id: 'bed',
    notes: 'Cama individual con cabecera, para un colchón estándar',
    measures: null,
    // A single mattress is 990 × 1900 mm: pieces-wise the depth is the bed's length, plus up to 300 mm of a bookcase headboard.
    expected: { width: [990, 1150], depth: [1900, 2350], height: [250, 1200] },
    anyOrientation: true,
  },
  {
    id: 'wall-cabinet',
    notes: 'Alacena de pared con dos puertas y una repisa en medio, para platos',
    measures: { height: 700, width: 800, depth: 300 },
    expected: { height: [700, 700], width: [800, 800], depth: [300, 300] },
  },
  {
    id: 'desk',
    notes: 'Escritorio sencillo con una repisa a un lado para la impresora',
    measures: null,
    expected: { height: [700, 780], width: [900, 1600], depth: [450, 750] },
  },
  {
    id: 'shoe-cabinet',
    notes: 'Zapatera para 12 pares, con repisas fijas y sin puertas',
    measures: { height: 900, width: 800, depth: 350 },
    expected: { height: [900, 900], width: [800, 800], depth: [350, 350] },
  },
  {
    id: 'tv-stand',
    notes: 'Mueble bajo para TV de 1.6 m de largo, con dos puertas a los lados y un hueco abierto en medio para el decodificador',
    measures: null,
    expected: { width: [1500, 1700], height: [350, 650], depth: [300, 500] },
  },
  {
    id: 'coffee-table',
    notes: 'Mesa de centro con un entrepaño abajo para revistas',
    measures: null,
    expected: { height: [350, 500], width: [700, 1300], depth: [400, 800] },
  },
  {
    id: 'plant-stand',
    notes: 'Un exhibidor escalonado para plantas, de triplay: tres escalones de 80 cm de ancho y 25 cm de fondo cada uno, el más alto a 75 cm del piso y cada uno 25 cm más bajo que el de atrás',
    measures: null,
    // No ficha has steps: the skeleton should leave it and design it piece by piece.
    expected: { width: [750, 850], depth: [650, 850], height: [650, 850] },
    path: 'pieces',
  },
]
