import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS } from '../assumptions'
import { JOINTS } from '../../../design/jointSpecs'
import type { Design, JointType } from '../../../design/schema'
import { backBoard } from '../../../materials/catalog'

const PERIMETER = new Set(['side', 'bottom', 'top'])
const RAILS = new Set(['bottom', 'top', 'shelf', 'apron', 'kick'])

/**
 * The boxes of a design, each the sides that rack together. When one piece joins every side (a cabinet's top, a bed's platform) it is one box, as always.
 * When none does (a stepped stand: each step its own shelf on its own two sides), each two parallel sides joined by one same piece are a box of their own.
 */
export function baysOf(design: Design): string[][] {
  const sides = design.pieces.filter((p) => p.role === 'side').map((p) => p.id)
  const isSide = new Set(sides)
  const normal = new Map(design.pieces.map((p) => [p.id, p.normal]))
  const sidesOf = new Map<string, Set<string>>()
  for (const u of design.joints)
    for (const [piece, other] of [[u.a, u.b], [u.b, u.a]])
      if (!isSide.has(piece) && isSide.has(other)) sidesOf.set(piece, new Set([...(sidesOf.get(piece) ?? []), other]))
  const joined = [...sidesOf.values()]
  if (!joined.length || joined.some((set) => set.size === sides.length)) return [sides]
  const pairs = new Map<string, string[]>()
  for (const set of joined) {
    const list = [...set].sort()
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) if (normal.get(list[i]) === normal.get(list[j])) pairs.set(`${list[i]} ${list[j]}`, [list[i], list[j]])
  }
  return pairs.size ? [...pairs.values()] : [sides]
}

/** R5: a carcass with no rigid back and no rigid frame racks like a parallelogram when pushed sideways; judged box by box. */
export const rackingRule: Rule = ({ design, geo, catalog }) => {
  const sides = design.pieces.filter((p) => p.role === 'side').map((p) => p.id)
  if (sides.length < 2) return []
  const role = new Map(design.pieces.map((p) => [p.id, p.role]))
  const normalOf = new Map(design.pieces.map((p) => [p.id, p.normal]))
  const joinedTo = (id: string, filter: (type: JointType, glued: boolean) => boolean) =>
    new Set(design.joints.filter((u) => (u.a === id || u.b === id) && filter(u.type, u.glue)).map((u) => (u.a === id ? u.b : u.a)))
  const bays = baysOf(design)

  return bays.flatMap((bay) => {
    // A full board in the back plane braces like a back: the spine of a bed base, screwed to both ends and the platform.
    // In a box of two sides, any upright board across them that is joined to one does: a back, a spine, the side of another step.
    const across = (p: Design['pieces'][number]) => p.normal !== 'y' && !bay.includes(p.id) && bay.every((side) => normalOf.get(side) !== p.normal) && bay.some((side) => joinedTo(p.id, () => true).has(side))
    const backs = design.pieces.filter((p) => (bay.length === sides.length ? p.role === 'back' || (p.role === 'divider' && p.normal === 'z') : ['back', 'divider', 'side'].includes(p.role) && across(p)))
    const rigidBack = backs.some((b) => {
      const thickness = geo.thicknesses.get(b.id) ?? 0
      const onPerimeter = (ids: Set<string>) => [...ids].filter((id) => PERIMETER.has(role.get(id) ?? 'other')).length
      const { nailedBackThickness, backJoins } = ASSUMPTIONS.racking
      if (thickness >= nailedBackThickness) return onPerimeter(joinedTo(b.id, () => true)) >= backJoins
      return onPerimeter(joinedTo(b.id, (type, glued) => (type === 'rabbet' || type === 'dado') && glued)) >= backJoins
    })

    const rails = design.pieces.filter((p) => RAILS.has(p.role) && p.support === 'fixed' && bay.every((side) => joinedTo(p.id, (type) => JOINTS[type].rigid).has(side)))
    const rigidFrame = rails.length >= ASSUMPTIONS.racking.rigidRails && rails.some((p) => p.role === 'apron' || p.role === 'kick')

    if (rigidBack || rigidFrame) return []
    // What racks is the box its sides make: in a cabinet the whole height, under a bed's headboard only the base, in a stepped stand each step.
    const height = Math.max(...bay.map((id) => geo.boxes.get(id)?.y1 ?? 0)) || design.dimensions.height
    const back = backBoard(catalog)
    const finding: Finding = {
      code: 'R5_RACKING',
      severity: height > ASSUMPTIONS.racking.criticalHeight ? 'critical' : 'recommendation',
      pieces: bay,
      message: 'Nada impide que el mueble se descuadre al empujarlo de lado: la trasera no lo amarra y las uniones no forman un marco rígido.',
      data: { height: height, rigidRails: rails.length },
      alternatives: [
        { key: 'back-6mm', description: `Trasera de ${back.thickness} mm clavada y pegada a laterales, piso y techo`, data: { material: back.id } },
        { key: 'back-in-rabbet', description: 'Trasera de 3 mm pegada en rebaje de laterales, piso y techo', data: { type: 'rabbet' } },
        { key: 'rigid-apron', description: rails.length ? 'Faja trasera superior con tornillos de bolsillo a los laterales' : 'Fajas atrás y adelante bajo la cubierta, con tornillos de bolsillo a los laterales', data: { type: 'pocket-screw' } },
      ],
    }
    return [finding]
  })
}
