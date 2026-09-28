// The trade words the app explains on tap, in the person's language. The source is docs/carpinteria/glosario.md: change it there first.

export interface Term {
  name: string
  meaning: string
  note?: string
}

export const TERMS = {
  trim: {
    name: 'Refilado',
    meaning: 'Quitar el canto de fábrica (golpeado, no escuadrado) de la hoja antes de dimensionar. Al planear el acomodo se descuentan unos 15 mm por lado.',
    note: 'La hoja útil es menor que la nominal.',
  },
  kerf: {
    name: 'Corte',
    meaning: 'Lo que se come la sierra en cada corte: 3–4 mm; para planear se usan 4 mm.',
    note: 'Si no se descuenta, la última pieza de la tira sale corta.',
  },
  clearance: {
    name: 'Holgura',
    meaning: 'Espacio que se deja a propósito para que algo se mueva o entre. En el acomodo de corte son unos 2 mm por pieza.',
    note: '«Tolerancia» es cuánto puede variar una medida, no un espacio.',
  },
  saveMaterial: {
    name: 'Ahorrar material',
    meaning: 'Busca otra combinación de lo que no fijaste para que las piezas quepan en menos hojas de triplay.',
    note: 'Lo fijado con candado no se toca, y nada cambia hasta que eliges una opción y la aplicas.',
  },
  face: { name: 'Cara', meaning: 'Cada una de las dos superficies grandes de un tablero. La cara buena va hacia afuera.' },
  edge: { name: 'Canto', meaning: 'Borde angosto de un tablero; en triplay deja ver las capas.' },
  arris: { name: 'Arista', meaning: 'Línea donde se juntan cara y canto. Se «matan» (redondean o biselan) con lija.' },
  easedEdge: {
    name: 'Matar arista a mano',
    meaning: 'Redondear la arista unos 1 mm con taco de lija 120 → 180.',
    note: 'Lo mínimo en todo canto que se ve: evita astillas y que el barniz se adelgace en la arista.',
  },
  roundover: {
    name: 'Redondeo',
    meaning: 'Arista redondeada en un cuarto de círculo, con router y broca de redondeo con balero o, si es chico, con lija; se nombra por su radio (3 mm, 6 mm).',
    note: 'En pino de 18 mm, uno de 6 mm deja a la vista 2–3 capas.',
  },
  chamfer: {
    name: 'Chaflán',
    meaning: 'Corte plano e inclinado que sustituye la arista, casi siempre a 45°; con broca de chaflán con balero, cepillo o lija.',
    note: 'En triplay muestra franjas rectas de capas.',
  },
} as const satisfies Record<string, Term>

export type TermKey = keyof typeof TERMS
