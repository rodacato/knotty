import type { Design, Piece } from './schema'
import type { Box } from './resolve'

// Where a drawer's runners go: the outer sides of its box and the piece beside each one, whatever built the drawer.

/** How far from a box side a piece still counts as the one that holds its runner. */
const SUPPORT_REACH = 60

interface DrawerSide {
  group: string
  side: Piece
  /** -1 for the left side, 1 for the right one. */
  towards: -1 | 1
  /** The closest vertical piece beside it, facing it, and how far it is. */
  support: { piece: Piece; distance: number } | null
}

const overlap = (a: Box, b: Box, axis: 'y' | 'z') => Math.min(a[`${axis}1`], b[`${axis}1`]) - Math.max(a[`${axis}0`], b[`${axis}0`]) > 0

export function drawerSides(design: Design, boxes: Map<string, Box>): DrawerSide[] {
  const groups = [...new Set(design.pieces.filter((p) => p.role === 'drawer-side' && p.group).map((p) => p.group!))]
  return groups.flatMap((group) => {
    const sides = design.pieces.filter((p) => p.group === group && p.role === 'drawer-side' && p.normal === 'x' && boxes.has(p.id)).sort((a, b) => boxes.get(a.id)!.x0 - boxes.get(b.id)!.x0)
    if (sides.length < 2) return []
    return ([
      [sides[0], -1],
      [sides[sides.length - 1], 1],
    ] as const).map(([side, towards]) => {
      const box = boxes.get(side.id)!
      const support =
        design.pieces
          .filter((p) => p.group !== group && p.normal === 'x' && boxes.has(p.id))
          .map((piece) => ({ piece, b: boxes.get(piece.id)! }))
          .filter(({ b }) => overlap(b, box, 'y') && overlap(b, box, 'z'))
          .map(({ piece, b }) => ({ piece, distance: towards < 0 ? box.x0 - b.x1 : b.x0 - box.x1 }))
          .filter(({ distance }) => distance >= -0.5 && distance <= SUPPORT_REACH)
          .sort((a, b) => a.distance - b.distance)[0] ?? null
      return { group, side, towards, support }
    })
  })
}
