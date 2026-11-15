// The catalog as a printed catalogue's plates (UI-93): each piece gets a plate shaped like its silhouette, and the plates are numbered as they read.

export type Shape = 'wide' | 'tall' | 'square'

/** A drawing this much wider than tall takes two columns; this much taller than wide, two rows. */
const WIDE = 1.6
const TALL = 0.75

export const shapeOf = (width: number, height: number): Shape => (width >= height * WIDE ? 'wide' : width <= height * TALL ? 'tall' : 'square')

export interface Plate {
  /** The piece's position in the list it came from. */
  index: number
  number: number
  row: number
  column: number
  columns: number
  rows: number
}

/**
 * Places the plates on a grid of `columns`, each one at the first free place in reading order (so a later small plate fills a hole
 * a wide one left), then numbers them as they read: top to bottom, left to right.
 */
export function packPlates(shapes: readonly Shape[], columns: number): Plate[] {
  const taken: boolean[][] = []
  const free = (row: number, column: number) => !taken[row]?.[column]
  const placed = shapes.map((shape, index) => {
    const span = { columns: shape === 'wide' ? Math.min(2, columns) : 1, rows: shape === 'tall' && columns > 1 ? 2 : 1 }
    for (let row = 0; ; row++) {
      for (let column = 0; column + span.columns <= columns; column++) {
        const cells = Array.from({ length: span.rows }, (_, r) => Array.from({ length: span.columns }, (_, c) => [row + r, column + c] as const)).flat()
        if (!cells.every(([r, c]) => free(r, c))) continue
        for (const [r, c] of cells) (taken[r] ??= [])[c] = true
        return { index, number: 0, row, column, ...span }
      }
    }
  })
  const reading = [...placed].sort((a, b) => a.row - b.row || a.column - b.column)
  reading.forEach((plate, i) => (plate.number = i + 1))
  return reading
}
