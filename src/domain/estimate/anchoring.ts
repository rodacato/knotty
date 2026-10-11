import { wallOf, type Design, type Wall } from '../design/schema'
import { roundTo, type Geometry } from '../design/resolve'
import { pickHardware, type Catalog, type Hardware } from '../materials/catalog'
import { ASSUMPTIONS } from '../assumptions'

// What an anchored piece is fixed to the wall with: the plug its wall takes and how many.

type KnownWall = Exclude<Wall, 'unknown'>

export const WALL_LABELS: Record<Wall, string> = { concrete: 'Concreto', brick: 'Tabique rojo', block: 'Block hueco', drywall: 'Tablaroca', unknown: 'No sé' }
const WALL_PHRASE: Record<KnownWall, string> = { concrete: 'concreto', brick: 'tabique rojo', block: 'block hueco', drywall: 'tablaroca' }
/** A hollow wall takes a toggle, which opens behind it; a solid one, a plug that swells in its hole. */
const PLUG_ROLE = { concrete: 'wall-plug', brick: 'wall-plug', block: 'toggle-plug', drywall: 'toggle-plug' } as const

export interface Anchoring {
  wall: KnownWall
  /** Hung from the wall, which carries all of it; standing, the wall only keeps it from tipping. */
  hung: boolean
  /** Null when no plug holds it there (a standing piece on drywall goes to a stud) or the catalog has none. */
  plug: Hardware | null
  count: number
  /** Hung: kg with every shelf loaded, and the kg pulling its top fixings out of the wall. */
  weight?: number
  pullOut?: number
}

/** A hung piece with its load: its weight, and the pull on its top fixings (weight × arm ÷ height between the top fixing and the bottom edge resting on the wall). */
function hungLoad(design: Design, geo: Geometry) {
  let weight = 0
  let moment = 0
  const boxes = design.pieces.flatMap((p) => {
    const box = geo.boxes.get(p.id)
    return box ? [{ p, box }] : []
  })
  const wallFace = Math.min(...boxes.map(({ box }) => box.z0))
  for (const { p, box } of boxes) {
    const [width, height, depth] = [box.x1 - box.x0, box.y1 - box.y0, box.z1 - box.z0]
    const own = (width * height * depth * ASSUMPTIONS.anchoring.density) / 1e9
    const carried = p.normal === 'y' ? (width * depth * ASSUMPTIONS.loads[p.load]) / 1e6 : 0
    weight += own + carried
    moment += (own + carried) * ((box.z0 + box.z1) / 2 - wallFace)
  }
  const rails = boxes.filter(({ p }) => p.role === 'brace').map(({ box }) => box)
  const fixing = rails.length ? Math.max(...rails.map((b) => (b.y0 + b.y1) / 2)) : Math.max(...boxes.map(({ box }) => box.y1))
  const lever = fixing - Math.min(...boxes.map(({ box }) => box.y0))
  return { weight, pullOut: lever > 0 ? moment / lever : weight, rails: rails.length }
}

/** Null when the piece is not anchored or its wall is not said: the general advice is all there is to say. */
export function anchoringOf(design: Design, geo: Geometry, catalog: Catalog): Anchoring | null {
  const wall = wallOf(design)
  if (!design.wallAnchored || wall === 'unknown') return null
  const { capacity, minAnchors } = ASSUMPTIONS.anchoring
  const plug = pickHardware(catalog, PLUG_ROLE[wall]) ?? null
  if (design.kind !== 'wallCabinet') {
    // The strap of an anti-tip kit pulls straight out of the wall, which drywall alone does not take: it goes to a stud.
    return wall === 'drywall' ? { wall, hung: false, plug: null, count: 0 } : { wall, hung: false, plug, count: minAnchors }
  }
  const { weight, pullOut, rails } = hungLoad(design, geo)
  // Every fixing shares the weight; a rail of its own needs a fixing of its own.
  const count = Math.max(minAnchors, rails, Math.ceil(Math.max(weight, pullOut) / capacity[wall]))
  return { wall, hung: true, plug, count, weight: roundTo(weight, 0), pullOut: roundTo(pullOut, 0) }
}

/** The 8 × 40 capacities are a maker's, for a nylon plug; the common plastic one has none published. */
const UNPROVEN: Partial<Record<KnownWall, string>> = {
  brick: ' Es la capacidad de un taquete de nylon y el tabique rojo varía mucho de uno a otro: tómala como una estimación sin validar.',
  concrete: ' Es la capacidad de un taquete de nylon: uno de plástico suave aguanta menos.',
}

/** What the person reads under the wall they chose. */
export function anchoringAdvice(anchoring: Anchoring | null): string {
  if (!anchoring) return 'Dime de qué es el muro y pongo en la lista los taquetes que le tocan.'
  const { wall, hung, count, weight } = anchoring
  if (!hung) {
    return wall === 'drywall'
      ? 'En tablaroca un taquete solo no aguanta el jalón de un antivuelco: el ancla va atornillada a un poste del muro. Por eso no pongo taquetes en la lista.'
      : `En ${WALL_PHRASE[wall]} van ${count} taquetes, uno por anclaje.`
  }
  return `Con las repisas cargadas pesa unos ${weight} kg, y todo cuelga del muro. En ${WALL_PHRASE[wall]} cada taquete aguanta ${ASSUMPTIONS.anchoring.capacity[wall]} kg: van ${count}.${UNPROVEN[wall] ?? ''}`
}
