import type { Dimensions, Role } from '../../domain/design/schema'
import type { FurnitureKind } from '../../domain/furniture/modules/plan'

// Fixed requests to try an expert with: the same in the comparison script and in the hidden bench.
// `expected` holds sensible ranges in mm for each piece of furniture; outside them, the expert misread the request.

export type Range = [number, number]

/** What a request did to the design: it is derived from the chat and the session, not reported by the expert. */
export type Outcome = 'applied' | 'pending' | 'answer' | 'rejected' | 'error'

interface Common {
  /** Defaults to true: a mandatory expectation that cannot be evaluated is `unknown` and counts as a problem. */
  mandatory?: boolean
  /** Why the product cannot check this: the expectation stays `unknown` and visible, and is not mandatory. */
  unsupported?: string
}

/** A closed set of checks on the state after a step; a spec with `unsupported` is declared, never evaluated. */
export type Expect = Common &
  (
    | { kind: 'dimensions'; ranges: Partial<Record<keyof Dimensions, Range>>; anyOrientation?: boolean }
    | { kind: 'origin'; path?: 'plan' | 'pieces'; module?: FurnitureKind }
    | { kind: 'parts'; part: Part; count: number | Range }
    /** Pieces by role, or by id prefix (a plan's naming, so only a design built from a plan can answer), optionally only the movable or fixed ones. */
    | { kind: 'pieces'; roles: Role[]; idPrefix?: string; support?: 'fixed' | 'movable'; count: number | Range }
    | { kind: 'planField'; field: string; allowed: (string | number | boolean)[] }
    | { kind: 'placement'; role: Role; half: 'upper' | 'lower' }
    | { kind: 'preserved'; dimension: keyof Dimensions }
    | { kind: 'requirement'; id?: string; type?: string }
    | { kind: 'noNewCritical' }
    | { kind: 'verdict'; allowed: string[] }
    | { kind: 'outcome'; allowed: Outcome[] }
    | { kind: 'declared'; what: string }
  )

/** What one chat request may do, and what must hold afterwards, on top of what the case carries from earlier steps. */
export interface AfterRequest {
  expect?: Expect[]
  /** Defaults to everything but a rejection or an error. */
  outcomes?: Outcome[]
  /** The dimensions the request is allowed to change; every other one must stay as it was. */
  changes?: (keyof Dimensions)[]
}

export interface BenchCase {
  id: string
  notes: string
  measures: Dimensions | null
  expected: Partial<Record<keyof Dimensions, Range>>
  /** A bed can lie either way: its plan runs it along the width, a piece-by-piece design along the depth. */
  anyOrientation?: boolean
  /** How the request should be designed: a shape no plan expresses must go piece by piece, and the other way is a misread. */
  path?: 'plan' | 'pieces'
  /** The module whose plan it should come from: another one is a misread too. */
  module?: FurnitureKind
  /** Chat requests made after the design, in order: the report says which Knotty answered alone and which went to the expert. */
  adjust?: string[]
  /** How many doors, drawers and open openings the request asks for: a design with others did not do what was asked. */
  parts?: Partial<Record<Part, number>>
  /** More expectations on the first design, from what the notes say; they carry to the later steps unless a step replaces them. */
  expect?: Expect[]
  /** What each request in `adjust` may do and must keep, by its text. */
  afterRequest?: Record<string, AfterRequest>
}

export type Part = 'doors' | 'drawers' | 'open'

export const BENCH_CASES: BenchCase[] = [
  {
    id: 'bookcase',
    notes: 'Librero de 5 repisas para libros, sin puertas, con zoclo al frente; va pegado a la pared',
    measures: { height: 1800, width: 800, depth: 300 },
    expected: { height: [1800, 1800], width: [800, 800], depth: [300, 300] },
    adjust: ['¿Cuánto cuesta?'],
    afterRequest: { '¿Cuánto cuesta?': { outcomes: ['answer'] } },
    parts: { doors: 0, drawers: 0 },
    expect: [
      // «5 repisas»: four loose shelves above the bottom board or five; a carpenter counts both as five.
      { kind: 'pieces', roles: ['shelf'], count: [4, 5] },
      { kind: 'pieces', roles: ['kick'], count: [1, 1] },
    ],
  },
  {
    id: 'bed-drawers',
    notes:
      'Quiero una cama individual con una base con cajones 3, y una cabecera como librero para poner cosas con un espacio cerrado donde va la almohada pero despues con 2 entrepaños como librero',
    measures: null,
    expected: { width: [990, 1150], depth: [1900, 2200], height: [700, 1400] },
    anyOrientation: true,
    parts: { drawers: 3 },
    expect: [
      { kind: 'planField', field: 'mattress', allowed: ['individual'] },
      { kind: 'planField', field: 'headboard.style', allowed: ['storage'] },
      { kind: 'planField', field: 'headboard.shelves', allowed: [2] },
    ],
  },
  {
    id: 'nightstand',
    notes: 'Buró con un cajón arriba y una repisa abierta abajo',
    measures: null,
    expected: { height: [450, 700], width: [350, 600], depth: [300, 500] },
    parts: { drawers: 1, open: 1 },
    expect: [{ kind: 'placement', role: 'drawer-front', half: 'upper' }],
  },
  {
    id: 'bed',
    notes: 'Cama individual con cabecera, para un colchón estándar',
    measures: null,
    // A single mattress is 990 × 1900 mm: pieces-wise the depth is the bed's length, plus up to 300 mm of a bookcase headboard.
    expected: { width: [990, 1150], depth: [1900, 2350], height: [250, 1200] },
    anyOrientation: true,
    // Two changes at once: Knotty does not read it alone, so it reaches the expert through the plan (plan-adjust).
    adjust: ['Súbela a 45 cm y ponle cajones del lado izquierdo'],
    expect: [
      { kind: 'planField', field: 'mattress', allowed: ['individual'] },
      { kind: 'planField', field: 'headboard.style', allowed: ['plain', 'bookcase', 'storage'] },
    ],
    afterRequest: {
      'Súbela a 45 cm y ponle cajones del lado izquierdo': {
        outcomes: ['applied', 'pending'],
        changes: ['height'],
        expect: [
          { kind: 'planField', field: 'height', allowed: [450] },
          { kind: 'planField', field: 'drawers.side', allowed: ['left'] },
          { kind: 'parts', part: 'drawers', count: [1, 8] },
        ],
      },
    },
  },
  {
    id: 'wall-cabinet',
    notes: 'Alacena de pared con dos puertas y una repisa en medio, para platos',
    measures: { height: 700, width: 800, depth: 300 },
    expected: { height: [700, 700], width: [800, 800], depth: [300, 300] },
    parts: { doors: 2 },
    expect: [{ kind: 'pieces', roles: ['shelf'], count: 1 }],
  },
  {
    id: 'desk',
    notes: 'Escritorio sencillo con una repisa a un lado para la impresora',
    measures: null,
    expected: { height: [700, 780], width: [900, 1600], depth: [450, 750] },
    expect: [{ kind: 'declared', what: 'a shelf at one side for the printer', unsupported: 'a desk has no shelf field and a side shelf has no piece role of its own to tell it from a drawer cell or a panel' }],
  },
  {
    id: 'shoe-cabinet',
    notes: 'Zapatera para 12 pares, con repisas fijas y sin puertas',
    measures: { height: 900, width: 800, depth: 350 },
    expected: { height: [900, 900], width: [800, 800], depth: [350, 350] },
    module: 'shoeRack',
    parts: { doors: 0 },
    expect: [
      { kind: 'pieces', roles: ['shelf'], support: 'movable', count: 0 },
      { kind: 'declared', what: '12 pairs of capacity', unsupported: 'the pair capacity is computed inside the shoe-rack module and not exposed by the design or its plan' },
    ],
  },
  {
    id: 'shoe-rack',
    notes: 'Una zapatera de 90 de alto para 12 pares, con puertas',
    measures: null,
    // Pairs of 230 mm side by side (muebles-y-medidas.md §2.6): 12 pairs on 4 or 5 levels of 900 mm take 3 or 4 across, 300–380 deep.
    expected: { height: [880, 920], width: [700, 1000], depth: [300, 380] },
    path: 'plan',
    module: 'shoeRack',
    adjust: ['Sin zoclo', '¿Cuántas hojas?'],
    expect: [
      { kind: 'parts', part: 'doors', count: [1, 8] },
      { kind: 'planField', field: 'front', allowed: ['doors'] },
      { kind: 'declared', what: '12 pairs of capacity', unsupported: 'the pair capacity is computed inside the shoe-rack module and not exposed by the design or its plan' },
    ],
    afterRequest: {
      'Sin zoclo': {
        outcomes: ['applied', 'pending'],
        expect: [
          { kind: 'pieces', roles: ['kick'], count: 0 },
          { kind: 'planField', field: 'base', allowed: ['floor'] },
        ],
      },
      '¿Cuántas hojas?': { outcomes: ['answer'] },
    },
  },
  {
    id: 'tv-stand',
    notes: 'Mueble bajo para TV de 1.6 m de largo, con dos puertas a los lados y un hueco abierto en medio para el decodificador',
    measures: null,
    expected: { width: [1500, 1700], height: [350, 650], depth: [300, 500] },
    parts: { doors: 2, open: 1 },
    expect: [{ kind: 'declared', what: 'doors at the sides and the open opening in the middle', unsupported: 'the order of the openings across the columns depends on how the expert shapes the plan; only their counts are checked' }],
  },
  {
    id: 'sideboard',
    // The first product of the reference catalog, KC-APA-01 (step 29 of the proposal). It does not say it goes against the wall on purpose:
    // with doors and drawers at 940 mm the plan prompt asks the expert to anchor it, and an R4 critical here means it did not.
    notes: 'Un aparador para el comedor de 1.60 de largo, 94 de alto y 40 de fondo: abajo tres puertas y a la derecha dos cajones; arriba un cajoncito a la izquierda y tres nichos abiertos. Terminado natural.',
    measures: { height: 940, width: 1600, depth: 400 },
    expected: { height: [940, 940], width: [1600, 1600], depth: [400, 400] },
    path: 'plan',
    module: 'cabinet',
    adjust: ['¿Cuánto cuesta?', 'Cambia el cajoncito de arriba por un nicho abierto'],
    parts: { doors: 3, drawers: 3, open: 3 },
    expect: [{ kind: 'declared', what: 'natural finish', unsupported: 'the finish is the person’s choice and the expert does not write it, so the design never carries it' }],
    afterRequest: {
      '¿Cuánto cuesta?': { outcomes: ['answer'] },
      'Cambia el cajoncito de arriba por un nicho abierto': {
        outcomes: ['applied', 'pending'],
        expect: [
          { kind: 'parts', part: 'drawers', count: 2 },
          { kind: 'parts', part: 'open', count: 4 },
        ],
      },
    },
  },
  {
    id: 'sideboard-explicit',
    // The same KC-APA-01 said column by column: if this one comes out right and `sideboard` does not, the expert misread the layout, not the counts.
    notes:
      'Un aparador para el comedor de 1.60 de largo, 94 de alto y 40 de fondo, en cuatro columnas iguales: en las tres primeras, puerta abajo y arriba (un cuarto del alto) un cajoncito en la primera y nichos abiertos en la segunda y la tercera; en la cuarta, dos cajones abajo y un nicho arriba. Terminado natural.',
    measures: { height: 940, width: 1600, depth: 400 },
    expected: { height: [940, 940], width: [1600, 1600], depth: [400, 400] },
    path: 'plan',
    module: 'cabinet',
    parts: { doors: 3, drawers: 3, open: 3 },
  },
  {
    id: 'coffee-table',
    notes: 'Mesa de centro con un entrepaño abajo para revistas',
    measures: null,
    expected: { height: [350, 500], width: [700, 1300], depth: [400, 800] },
    expect: [{ kind: 'pieces', roles: ['shelf'], count: 1 }],
  },
  {
    id: 'plant-stand',
    notes: 'Un exhibidor escalonado para plantas, de triplay: tres escalones de 80 cm de ancho y 25 cm de fondo cada uno, el más alto a 75 cm del piso y cada uno 25 cm más bajo que el de atrás',
    measures: null,
    // No plan has steps: the skeleton should leave it and design it piece by piece.
    expected: { width: [750, 850], depth: [650, 850], height: [650, 850] },
    path: 'pieces',
    expect: [{ kind: 'declared', what: 'three steps 250 mm apart', unsupported: 'a step has no piece role of its own, so the number of steps and their heights cannot be told from the design' }],
  },
]
