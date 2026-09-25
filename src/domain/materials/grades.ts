// What a board is, apart from what it is used for: the knowledge of each grade of sheet the catalog sells.
// A catalog material names its grade; the rules and the 3D ask the grade, never the material's id.
// Each value says where it comes from (docs/carpinteria). Values that vary with the thickness go in rows
// by thickness (the first row whose `upTo` is at least the board's), so a table from the reference fits as is.

export const GRADE_IDS = ['pine-plywood'] as const
export type GradeId = (typeof GRADE_IDS)[number]

/** How a board looks in 3D: the colors of its face and its edge are the UI's, by this key. */
export type BoardTone = 'pine' | 'pale-pine'

type ByThickness<T> = readonly ({ upTo: number } & T)[]

export interface Grade {
  /** For the person. */
  name: string
  /** What the product is and where it is sold. */
  source: string
  /** MPa, bending with the face grain along the span (parallel) or across it (perpendicular). */
  stiffness: { source: string; rows: ByThickness<{ parallel: number; perpendicular: number }> }
  /** Plies seen on the edge and the tone of the face. */
  look: ByThickness<{ tone: BoardTone; plies: number }>
}

export const GRADES: Record<GradeId, Grade> = {
  'pine-plywood': {
    name: 'Triplay de pino',
    source: 'docs/carpinteria/triplay.md: pine plywood (radiata or elliottii) as Home Depot MX sells it',
    stiffness: {
      // The reference recommends lower values by thickness (docs/carpinteria/valores-de-referencia.md §1:
      // 4500 ∥ / 2000 ⊥ in 18 mm); adopting them changes the checks, so it goes in its own change.
      source: 'docs/carpinteria/estructura.md §1.2: 6000 ∥ is APA Group 1, the optimistic value; 3500 ⊥ sits between 5 and 7 plies',
      rows: [{ upTo: Infinity, parallel: 6000, perpendicular: 3500 }],
    },
    // docs/carpinteria/triplay.md «Espesores y número de capas»: pine has 3 plies in 3 and 6 mm and 7 in 18 mm
    // (5 in 9 and 12 mm, not drawn yet). The paler face of the thin sheets is a choice of the 3D, not a fact.
    look: [
      { upTo: 6, tone: 'pale-pine', plies: 3 },
      { upTo: Infinity, tone: 'pine', plies: 7 },
    ],
  },
}

const row = <T>(rows: ByThickness<T>, thickness: number) => rows.find((r) => thickness <= r.upTo) ?? rows[rows.length - 1]

/** The grade's stiffness for a board of this thickness, in MPa. */
export function stiffness(grade: GradeId, thickness: number) {
  const { parallel, perpendicular } = row(GRADES[grade].stiffness.rows, thickness)
  return { parallel, perpendicular }
}

/** How a board of this grade and thickness looks in 3D. */
export function boardLook(grade: GradeId, thickness: number) {
  const { tone, plies } = row(GRADES[grade].look, thickness)
  return { tone, plies }
}
