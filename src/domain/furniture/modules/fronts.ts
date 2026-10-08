import type { Box } from '../../design/resolve'
import type { Cut, Design, Piece, Span } from '../../design/schema'
import { ASSUMPTIONS } from '../../assumptions'
import { lifts, slides } from '../../design/doors'

// What is taken out of a door or a drawer front: a finger notch to open it, or grooves that make it ribbed. Only drawn: they change neither the cut list nor the purchase.

/** A groove is at most a third of the board deep and never more than half of it (valores-de-referencia.md, «Profundidad de ranura»). */
const GROOVE_DEPTH_SHARE = 1 / 3
const NOTCH_DEPTH_SHARE = 1 / 2
/** Chosen, not sourced: a 6 mm router bit, a rib every 30 mm, and a border left smooth. */
const GROOVE_WIDTH = 6
const GROOVE_PITCH = 30
const GROOVE_BORDER = 15
/** The finger notch: as wide as a finger and a half, and as deep in the face as it is tall. */
const NOTCH_LENGTH = 100
const NOTCH_HEIGHT = 22
/** A cut starts this far out of the board so it opens the edge instead of stopping a hair short of it. */
const OUT = 1

const isFront = (p: Piece) => p.role === 'door' || p.role === 'drawer-front'
const span = (from: Span['from'], offset: number, length: number): Span => ({ from, offset, length })
/** From the front face inward. */
const deep = (depth: number) => span('end', -OUT, depth + OUT)

function grooves(box: Box): Cut[] {
  const width = box.x1 - box.x0
  const thickness = box.z1 - box.z0
  const count = Math.floor((width - 2 * GROOVE_BORDER + (GROOVE_PITCH - GROOVE_WIDTH)) / GROOVE_PITCH)
  if (count < 1) return []
  const first = (width - (count * GROOVE_PITCH - (GROOVE_PITCH - GROOVE_WIDTH))) / 2
  return Array.from({ length: count }, (_, i) => ({ x: span('start', first + i * GROOVE_PITCH, GROOVE_WIDTH), y: span('start', -OUT, box.y1 - box.y0 + 2 * OUT), z: deep(thickness * GROOVE_DEPTH_SHARE) }))
}

/** A lid's notch goes through its front edge, in the middle: a finger gets under it there. */
const lidNotch = (box: Box): Cut => ({ x: span('center', 0, Math.min(NOTCH_LENGTH, box.x1 - box.x0 - 2 * GROOVE_BORDER)), y: span('start', -OUT, box.y1 - box.y0 + 2 * OUT), z: span('end', -OUT, NOTCH_HEIGHT + OUT) })

/** The notch of a drawer front sits on its top edge, in the middle; a door's, on the edge away from its hinge, halfway up. */
function notch(piece: Piece, box: Box, hingeOnLeft: boolean): Cut {
  const width = box.x1 - box.x0
  const height = box.y1 - box.y0
  const depth = deep((box.z1 - box.z0) * NOTCH_DEPTH_SHARE)
  if (piece.role === 'drawer-front') return { x: span('center', 0, Math.min(NOTCH_LENGTH, width - 2 * GROOVE_BORDER)), y: span('end', -OUT, NOTCH_HEIGHT + OUT), z: depth }
  const along = span('center', 0, Math.min(NOTCH_LENGTH, height - 2 * GROOVE_BORDER))
  return { x: hingeOnLeft ? span('end', -OUT, NOTCH_HEIGHT + OUT) : span('start', -OUT, NOTCH_HEIGHT + OUT), y: along, z: depth }
}

/** Which side each door hangs on, read from its hinge joint. A sliding leaf has none: it counts as hung on the middle of its track, so its notch is on its outer edge, where the other leaf never covers it. */
function hingeSides(design: Design, boxes: Map<string, Box>): Map<string, boolean> {
  const sides = new Map<string, boolean>()
  for (const u of design.joints) {
    const door = boxes.get(u.a)
    const held = boxes.get(u.b)
    if ((u.type === 'cup-hinge' || slides(design, u.a)) && door && held) sides.set(u.a, (held.x0 + held.x1) / 2 < (door.x0 + door.x1) / 2)
  }
  return sides
}

/** The design with the notches and the grooves its plan asks for, door by door and front by front. */
export function withFrontCuts(design: Design, boxes: Map<string, Box>, askOf: (front: Piece) => { notch: boolean; grooved: boolean }): Design {
  const sides = hingeSides(design, boxes)
  return {
    ...design,
    pieces: design.pieces.map((p) => {
      const box = boxes.get(p.id)
      if (!box || !isFront(p)) return p
      const ask = askOf(p)
      // A lid lies flat: its face is not a front to rib, and its notch is its own.
      const lid = lifts(design, p.id)
      const cuts = [...(ask.grooved && !lid ? grooves(box) : []), ...(ask.notch ? [lid ? lidNotch(box) : notch(p, box, sides.get(p.id) ?? false)] : [])]
      return cuts.length ? { ...p, cuts } : p
    }),
  }
}

/** What the person reads when some fronts are opened by a notch: nothing to buy, a router cut. */
export const notchNote = (fronts: number) => `Muesca para abrir en el canto de ${fronts} ${fronts === 1 ? 'frente' : 'frentes'}: se fresa con router, no se compra nada.`

const mm = (n: number) => String(Math.round(n * 10) / 10)
/** What the person reads when doors slide: nothing to buy, two grooves per leaf, and why the one above is deeper. */
export const slidingNote = (leaves: number, board: number) => {
  const into = board * ASSUMPTIONS.sliding.engagement
  return `${leaves === 1 ? 'Puerta corrediza' : `${leaves} puertas corredizas`} sin bisagras: cada hoja corre en una ranura del tablero de abajo, de ${mm(into)} mm de hondo, y otra del de arriba, de ${mm(2 * into)} mm, para meterla y sacarla levantándola. Las ranuras se fresan con router antes de armar, un poco más anchas que la hoja.`
}

/** What the person reads when there is a rod to hang clothes from: what it is cut from and where its flanges go. */
export const rodNote = (rods: number) =>
  `${rods === 1 ? 'Tubo para colgar' : `${rods} tubos para colgar`}: se ${rods === 1 ? 'corta' : 'cortan'} con segueta al ancho del hueco y ${rods === 1 ? 'va' : 'van'} con una brida atornillada a cada costado, al centro del fondo.`

/** What the person reads when a chest opens from above: what holds each lid, and why it goes to a strip and not to the back. */
export const lidNote = (lids: number) =>
  `${lids === 1 ? 'Tapa abatible' : `${lids} tapas abatibles`} hacia arriba: cada una va con bisagra de piano a la tira fija de atrás, no a la trasera, y un compás de fricción atornillado al costado la detiene abierta (dos, uno por costado, en una tapa pesada). Antes de abrirla hay que quitar lo que tenga encima.`
