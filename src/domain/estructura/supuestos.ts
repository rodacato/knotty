import type { Carga, TipoUnion } from '../diseno/esquema'

// Supuestos de ingeniería como datos, para calibrarlos sin tocar las reglas. Triplay de pino de Home Depot MX.

export const SUPUESTOS = {
  /** MPa, flexión del triplay de pino según la veta respecto al claro. Conservador; calibrar con una prueba casera. */
  moduloElasticidad: { paralela: 6000, perpendicular: 3500 },
  /** La carga sostenida (libros meses y meses) aumenta la flecha. */
  fluencia: 1.5,
  /** kg/m² sobre el entrepaño. */
  cargas: { ninguna: 0, ligera: 50, media: 100, pesada: 150 } satisfies Record<Carga, number>,
  gravedad: 9.81,
  /** La flecha se compara con claro / límite. */
  limiteFlecha: { recomendacion: 360, critico: 200 },
  /** Alto a partir del cual un casco que se puede descuadrar es crítico. */
  altoEscuadradoCritico: 600,
  uniones: {
    'tope-tornillo': { b: 15, bCritico: 12 },
    bolsillo: { a: 12, b: 12 },
    tarugo: { a: 15, b: 15 },
    minifix: { a: 15, b: 15 },
    canal: { b: 15 },
    rebaje: { b: 15 },
    'bisagra-cazoleta': { a: 15 },
    'soporte-repisa': { b: 15 },
  } satisfies Partial<Record<TipoUnion, { a?: number; b?: number; bCritico?: number }>>,
  /** Profundidad de canal o rebaje como fracción del espesor que la recibe. */
  penetracion: { recomendacion: 1 / 3, critico: 1 / 2 },
  /** Hasta este espesor, una pieza solo se clava o va en canal o rebaje. */
  espesorDeClavar: 3,
  tornillos: {
    /** Lo mínimo que el tornillo entra en la pieza que lo recibe. */
    penetracionMinima: 25,
    /** Distancia mínima del tornillo al extremo de la junta, para no rajar el canto. */
    distanciaExtremo: 25,
    /** Tornillo de bolsillo que no se asoma, según el espesor de la pieza con el bolsillo (tabla de Kreg). */
    bolsilloMaximo: [
      { hasta: 13, largo: 25.4 },
      { hasta: 16, largo: 25.4 },
      { hasta: 19, largo: 31.75 },
    ],
  },
  vuelco: { relacionRecomendacion: 3, relacionCritica: 4, altoCritico: 1200 },
  puertas: { bisagras: [{ hasta: 900, n: 2 }, { hasta: 1500, n: 3 }, { hasta: Infinity, n: 4 }], anchoMaximo: 600 },
  /** Claro máximo de un piso sin apoyo intermedio cuando no descansa en el suelo. */
  claroPiso: 800,
  cajones: {
    /** Cuánto puede variar el hueco de la corredera respecto a lo que pide el fabricante. */
    toleranciaCorredera: 1,
    fondoMinimo: 6,
    /** Arriba de este ancho, un fondo más delgado que el mínimo se vence. */
    anchoFondoDelgado: 450,
    /** Minimum gap between a drawer and the ground, so it opens without dragging. */
    holguraSuelo: 10,
  },
} as const

export const bisagrasPara = (alto: number) => SUPUESTOS.puertas.bisagras.find((b) => alto <= b.hasta)!.n

export const UNIONES_RIGIDAS: TipoUnion[] = ['bolsillo', 'tarugo', 'minifix', 'canal', 'rebaje', 'escuadra']
