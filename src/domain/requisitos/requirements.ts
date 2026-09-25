import { z } from 'zod'
import { DIMENSION_OF_AXIS, DIMENSION_LABEL, Axis, type Design } from '../diseno/schema'
import { error, type DesignError } from '../validation/errors'

// Facts the person stated. They survive going back a version: "my space is 90 cm wide" is still true.
// Their fields are saved and written by the expert.

export const Requirement = z.object({
  id: z.string().min(1).describe('Clave corta y estable, por ejemplo "espacio-ancho"'),
  text: z.string().min(1).describe('Como lo diría el usuario: "Mi espacio mide 90 cm de ancho"'),
  type: z.enum(['space', 'load', 'tool', 'style', 'other']),
  axis: Axis.nullable().describe('Solo para type space'),
  min: z.number().nullable().describe('Solo para type space, en mm'),
  max: z.number().nullable().describe('Solo para type space, en mm'),
})
export type Requirement = z.infer<typeof Requirement>

export function checkRequirements(design: Design, requirements: Requirement[]): DesignError[] {
  return requirements.flatMap((r) => {
    if (r.type !== 'space' || !r.axis) return []
    const measure = design.dimensions[DIMENSION_OF_AXIS[r.axis]]
    const outside = (r.max !== null && measure > r.max) || (r.min !== null && measure < r.min)
    return outside ? [error('E_REQUISITO', `El ${DIMENSION_LABEL[DIMENSION_OF_AXIS[r.axis]]} de ${measure} mm no respeta "${r.text}".`, { requisito: r.id, medida: measure, min: r.min, max: r.max })] : []
  })
}

/** Adds or replaces by id, and drops the ones named. The shape of the change is the expert's. */
export function updateRequirements(current: Requirement[], changes: { add: Requirement[]; remove: string[] }): Requirement[] {
  const next = new Map(current.filter((r) => !changes.remove.includes(r.id)).map((r) => [r.id, r]))
  for (const r of changes.add) next.set(r.id, r)
  return [...next.values()]
}
