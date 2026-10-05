import { extent, ref } from '../../design/builders'
import { drawerGroups } from '../../design/boxes'
import type { Box } from '../../design/resolve'
import type { Cut, Design, Piece, Span } from '../../design/schema'
import { materialById, type Catalog } from '../../materials/catalog'

// The corners of a drawer box cut as interlocking fingers: the sides run the whole depth, the front and back the whole width, and each corner is a stack of fingers that alternate between the two boards.
// The voids are only drawn; the boards themselves are as long as they are cut, so the cut list is right without them.

/** Fingers per corner when the plan does not say: odd, so the top and the bottom of a corner belong to the same board. */
export const DEFAULT_FINGERS = 5
export const FINGERS_RANGE = { min: 3, max: 21 }

/** A cut starts this far out of the board so it opens the face instead of stopping a hair short of it. */
const OUT = 1
const span = (from: Span['from'], offset: number, length: number): Span => ({ from, offset, length })
const round = (mm: number) => Math.round(mm * 100) / 100

const ENDS = ['subfront', 'back']
const SIDES = ['side-left', 'side-right']

/** The drawers of the design whose box has all four corners to cut. */
const boxesOf = (design: Design) => drawerGroups(design).filter((g) => [...SIDES, ...ENDS].every((part) => design.pieces.some((p) => p.id === `${g}-${part}`)))

/** The front and the back of each drawer box span from the outside of one side to the outside of the other, and the four corners become finger joints. */
export function withFingerBoxes(design: Design, catalog: Catalog): Design {
  const groups = new Set(boxesOf(design))
  if (!groups.size) return design
  const ends = new Set([...groups].flatMap((g) => ENDS.map((part) => `${g}-${part}`)))
  const sides = new Set([...groups].flatMap((g) => SIDES.map((part) => `${g}-${part}`)))
  const byId = new Map(design.pieces.map((p) => [p.id, p]))
  return {
    ...design,
    pieces: design.pieces.map((p): Piece => (ends.has(p.id) ? { ...p, x: extent(ref(`${p.group}-side-left.x0`), ref(`${p.group}-side-right.x1`)) } : p)),
    joints: design.joints.map((u) => {
      if (!sides.has(u.a) || !ends.has(u.b)) return u
      const board = byId.get(u.b)!
      const thickness = materialById(catalog, board.material)?.thickness
      return thickness ? { ...u, type: 'finger', glue: true, depth: thickness, hardware: [] } : u
    }),
  }
}

/** The part of `b` that `a` also takes up, or null when they only touch. */
function overlap(a: Box, b: Box): Box | null {
  const o = { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) }
  return o.x1 > o.x0 && o.y1 > o.y0 && o.z1 > o.z0 ? o : null
}

const AXES = ['x', 'y', 'z'] as const
const low = (b: Box, e: (typeof AXES)[number]) => b[`${e}0` as const]
const high = (b: Box, e: (typeof AXES)[number]) => b[`${e}1` as const]

/** The fingers run along the longest side of the corner column; in each slice one board keeps the wood and the other has the void, alternating from the first board. */
export function withFingerCuts(design: Design, boxes: Map<string, Box>, fingers: number): Design {
  const added = new Map<string, Cut[]>()
  const push = (id: string, cut: Cut) => added.set(id, [...(added.get(id) ?? []), cut])
  for (const u of design.joints) {
    if (u.type !== 'finger') continue
    const [first, second] = [boxes.get(u.a), boxes.get(u.b)]
    const corner = first && second && overlap(first, second)
    if (!corner) continue
    const along = AXES.reduce((best, e) => (high(corner, e) - low(corner, e) > high(corner, best) - low(corner, best) ? e : best))
    const width = (high(corner, along) - low(corner, along)) / fingers
    for (let i = 0; i < fingers; i++) {
      // The void goes in the board that does not own the slice: the second board on even slices, the first on odd ones.
      const [id, piece] = i % 2 === 0 ? [u.b, second] : [u.a, first]
      const slice = { ...corner, [`${along}0`]: low(corner, along) + i * width, [`${along}1`]: low(corner, along) + (i + 1) * width } as Box
      const spanOf = (e: (typeof AXES)[number]): Span => {
        const [lo, hi] = [low(slice, e) <= low(piece, e) + 0.01 ? low(piece, e) - OUT : low(slice, e), high(slice, e) >= high(piece, e) - 0.01 ? high(piece, e) + OUT : high(slice, e)]
        return span('start', round(lo - low(piece, e)), round(hi - lo))
      }
      push(id, { x: spanOf('x'), y: spanOf('y'), z: spanOf('z') })
    }
  }
  return added.size ? { ...design, pieces: design.pieces.map((p) => (added.has(p.id) ? { ...p, cuts: [...(p.cuts ?? []), ...added.get(p.id)!] } : p)) } : design
}

/** How many drawers have fingers, for the note that tells the person how they are cut. */
export const fingerDrawers = (design: Design) => boxesOf(design).filter((g) => design.joints.some((u) => u.type === 'finger' && u.a.startsWith(`${g}-`))).length

/** What the person reads about drawers with finger corners: how they are cut and that they show. */
export const fingerDrawersNote = (drawers: number, fingers: number) =>
  `Esquinas de dedos en ${drawers} ${drawers === 1 ? 'cajón' : 'cajones'}, ${fingers} por esquina: se cortan con router en mesa o con sierra de mesa y plantilla, y se arman con pegamento. Quedan a la vista.`
