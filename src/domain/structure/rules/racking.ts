import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS, RIGID_JOINTS } from '../assumptions'

const PERIMETER = new Set(['side', 'bottom', 'top'])
const RAILS = new Set(['bottom', 'top', 'shelf', 'apron', 'kick'])

/** R5: a carcass with no rigid back and no rigid frame racks like a parallelogram when pushed sideways. */
export const rackingRule: Rule = ({ design, geo }) => {
  const sides = design.pieces.filter((p) => p.role === 'side').map((p) => p.id)
  if (sides.length < 2) return []
  const role = new Map(design.pieces.map((p) => [p.id, p.role]))
  const joinedTo = (id: string, filter: (type: string, glued: boolean) => boolean) =>
    new Set(design.joints.filter((u) => (u.a === id || u.b === id) && filter(u.type, u.glue)).map((u) => (u.a === id ? u.b : u.a)))

  // A full board in the back plane braces like a back: the spine of a bed base, screwed to both ends and the platform.
  const backs = design.pieces.filter((p) => p.role === 'back' || (p.role === 'divider' && p.normal === 'z'))
  const rigidBack = backs.some((b) => {
    const thickness = geo.thicknesses.get(b.id) ?? 0
    const onPerimeter = (ids: Set<string>) => [...ids].filter((id) => PERIMETER.has(role.get(id) ?? 'other')).length
    if (thickness >= 6) return onPerimeter(joinedTo(b.id, () => true)) >= 3
    return onPerimeter(joinedTo(b.id, (type, glued) => (type === 'rabbet' || type === 'dado') && glued)) >= 3
  })

  const rails = design.pieces.filter((p) => RAILS.has(p.role) && p.support === 'fixed' && sides.every((side) => joinedTo(p.id, (type) => RIGID_JOINTS.includes(type as never)).has(side)))
  const rigidFrame = rails.length >= 2 && rails.some((p) => p.role === 'apron' || p.role === 'kick')

  if (rigidBack || rigidFrame) return []
  // What racks is the box the sides make: in a cabinet the whole height, under a bed's headboard only the base.
  const height = Math.max(...sides.map((id) => geo.boxes.get(id)?.y1 ?? 0)) || design.dimensions.height
  const finding: Finding = {
    code: 'R5_RACKING',
    severity: height > ASSUMPTIONS.criticalRackingHeight ? 'critical' : 'recommendation',
    pieces: sides,
    message: 'Nada impide que el mueble se descuadre al empujarlo de lado: la trasera no lo amarra y las uniones no forman un marco rígido.',
    data: { alto: height, travesanosRigidos: rails.length },
    alternatives: [
      { key: 'trasera-6', description: 'Trasera de 6 mm clavada y pegada a laterales, piso y techo', data: { material: 'TR6' } },
      { key: 'trasera-en-rebaje', description: 'Trasera de 3 mm pegada en rebaje de laterales, piso y techo', data: { tipo: 'rebaje' } },
      { key: 'faja-rigida', description: 'Faja trasera superior con tornillos de bolsillo a los laterales', data: { tipo: 'bolsillo' } },
    ],
  }
  return [finding]
}
