import type { Carga, TipoUnion } from '../diseno/esquema'

// Supuestos de ingeniería como datos, para calibrarlos sin tocar las reglas. Triplay de pino de Home Depot MX.

export const ASSUMPTIONS = {
  /** MPa, flexión del triplay de pino según la veta respecto al claro. Conservador; calibrar con una prueba casera. */
  elasticModulus: { parallel: 6000, perpendicular: 3500 },
  /** La carga sostenida (libros meses y meses) aumenta la flecha. */
  creep: 1.5,
  /** kg/m² sobre el entrepaño. */
  loads: { ninguna: 0, ligera: 50, media: 100, pesada: 150 } satisfies Record<Carga, number>,
  gravity: 9.81,
  /** La flecha se compara con claro / límite. */
  deflectionLimit: { recommended: 360, critical: 200 },
  /** Alto a partir del cual un casco que se puede descuadrar es crítico. */
  criticalRackingHeight: 600,
  joints: {
    'tope-tornillo': { b: 15, bCritical: 12 },
    bolsillo: { a: 12, b: 12 },
    tarugo: { a: 15, b: 15 },
    minifix: { a: 15, b: 15 },
    canal: { b: 15 },
    rebaje: { b: 15 },
    'bisagra-cazoleta': { a: 15 },
    'soporte-repisa': { b: 15 },
  } satisfies Partial<Record<TipoUnion, { a?: number; b?: number; bCritical?: number }>>,
  /** Profundidad de canal o rebaje como fracción del espesor que la recibe. */
  penetration: { recommended: 1 / 3, critical: 1 / 2 },
  /** Hasta este espesor, una pieza solo se clava o va en canal o rebaje. */
  nailOnlyThickness: 3,
  screws: {
    /** Lo mínimo que el tornillo entra en la pieza que lo recibe. */
    minPenetration: 25,
    /** Distancia mínima del tornillo al extremo de la junta, para no rajar el canto. */
    endDistance: 25,
    /** Tornillo de bolsillo que no se asoma, según el espesor de la pieza con el bolsillo (tabla de Kreg). */
    pocketScrews: [
      { upTo: 13, length: 25.4 },
      { upTo: 16, length: 25.4 },
      { upTo: 19, length: 31.75 },
    ],
  },
  tipping: { recommendedRatio: 3, criticalRatio: 4, criticalHeight: 1200 },
  doors: { hinges: [{ upTo: 900, n: 2 }, { upTo: 1500, n: 3 }, { upTo: Infinity, n: 4 }], maxWidth: 600 },
  /** Claro máximo de un piso sin apoyo intermedio cuando no descansa en el suelo. */
  floorSpan: 800,
  drawers: {
    /** Cuánto puede variar el hueco de la corredera respecto a lo que pide el fabricante. */
    runnerTolerance: 1,
    minBottom: 6,
    /** Arriba de este ancho, un fondo más delgado que el mínimo se vence. */
    thinBottomWidth: 450,
    /** Minimum gap between a drawer and the ground, so it opens without dragging. */
    floorClearance: 10,
  },
} as const

export const hingesFor = (alto: number) => ASSUMPTIONS.doors.hinges.find((b) => alto <= b.upTo)!.n

export const RIGID_JOINTS: TipoUnion[] = ['bolsillo', 'tarugo', 'minifix', 'canal', 'rebaje', 'escuadra']
