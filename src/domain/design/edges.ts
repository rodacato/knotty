import { CONTACT_TOLERANCE } from './boxes'
import type { Geometry } from './resolve'
import type { Axis, Design, Edge, EdgeProfileChoice } from './schema'
import { contactBetween } from './validation/contact'

// The four edges around a piece's face, and which of them rest against another piece: those cannot be seen, so they take no profile.

/** Where each edge is: the axis it faces along and whether it is the smaller (0) or larger (1) end. */
export const EDGE_SIDE: Record<Edge, { axis: Axis; end: 0 | 1 }> = {
  front: { axis: 'z', end: 1 },
  back: { axis: 'z', end: 0 },
  left: { axis: 'x', end: 0 },
  right: { axis: 'x', end: 1 },
  top: { axis: 'y', end: 1 },
  bottom: { axis: 'y', end: 0 },
}

/** The edges around the face of a piece with this thickness axis, in the order the sheet lists them. */
const FACE_EDGES: Record<Axis, Edge[]> = {
  y: ['front', 'left', 'right', 'back'],
  x: ['front', 'top', 'bottom', 'back'],
  z: ['top', 'left', 'right', 'bottom'],
}

/** For each edge of the piece's face, the piece it rests against, or null when it is free. */
export function edgeNeighbours(design: Design, geo: Geometry, pieceId: string): { edge: Edge; against: string | null }[] {
  const piece = design.pieces.find((p) => p.id === pieceId)
  const box = geo.boxes.get(pieceId)
  if (!piece || !box) return []
  return FACE_EDGES[piece.normal].map((edge) => {
    const { axis, end } = EDGE_SIDE[edge]
    const face = box[`${axis}${end}`]
    const against = [...geo.boxes].find(([id, other]) => {
      if (id === pieceId) return false
      const contact = contactBetween(pieceId, box, id, other)
      const facing = end ? other[`${axis}0`] : other[`${axis}1`]
      return contact?.axis === axis && Math.abs(facing - face) <= CONTACT_TOLERANCE
    })
    return { edge, against: against?.[0] ?? null }
  })
}

/** The profiles of one piece, by edge. */
export const profilesOf = (design: Design, pieceId: string): EdgeProfileChoice[] => (design.edgeProfiles ?? []).filter((c) => c.piece === pieceId)

/** Each edge as the person names it. */
export const EDGE_LABEL: Record<Edge, string> = { front: 'Frente', back: 'Atrás', left: 'Izquierda', right: 'Derecha', top: 'Arriba', bottom: 'Abajo' }

/** The design with exactly these edges of the piece profiled; the other pieces keep theirs. */
export const withPieceProfiles = (design: Design, pieceId: string, choices: Omit<EdgeProfileChoice, 'piece'>[]): Design => ({
  ...design,
  edgeProfiles: [...(design.edgeProfiles ?? []).filter((c) => c.piece !== pieceId), ...choices.map((c) => ({ piece: pieceId, ...c }))],
})

/** How long an edge is: the side of the face it runs along. */
function edgeLength(geo: Geometry, pieceId: string, normal: Axis, edge: Edge) {
  const box = geo.boxes.get(pieceId)!
  const along = (['x', 'y', 'z'] as Axis[]).find((a) => a !== normal && a !== EDGE_SIDE[edge].axis)!
  return box[`${along}1`] - box[`${along}0`]
}

export interface ProfiledEdges {
  piece: string
  edges: Edge[]
  profile: EdgeProfileChoice['profile']
  /** Their length added up, in mm. */
  length: number
}

/** The profiled edges that are still free, by piece and profile, for the shopping and finishing list. */
export function profiledEdges(design: Design, geo: Geometry): ProfiledEdges[] {
  const lines: ProfiledEdges[] = []
  for (const p of design.pieces) {
    const free = new Set(edgeNeighbours(design, geo, p.id).filter((n) => !n.against).map((n) => n.edge))
    for (const c of profilesOf(design, p.id).filter((c) => free.has(c.edge))) {
      const line = lines.find((l) => l.piece === p.id && l.profile === c.profile)
      const length = edgeLength(geo, p.id, p.normal, c.edge)
      if (line) {
        line.edges.push(c.edge)
        line.length += length
      } else lines.push({ piece: p.id, edges: [c.edge], profile: c.profile, length })
    }
  }
  return lines
}
