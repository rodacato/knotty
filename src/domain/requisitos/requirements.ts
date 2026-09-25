import { z } from 'zod'
import { DIMENSION_OF_AXIS, Axis, type Design } from '../diseno/schema'
import { error, type DesignError } from '../validation/errors'

// Facts the person stated. They survive going back a version: "my space is 90 cm wide" is still true.
// Their fields are saved and written by the expert: they stay in Spanish until step 9.

export const Requirement = z.object({
  id: z.string().min(1).describe('Clave corta y estable, por ejemplo "espacio-ancho"'),
  texto: z.string().min(1).describe('Como lo diría el usuario: "Mi espacio mide 90 cm de ancho"'),
  tipo: z.enum(['espacio', 'carga', 'herramienta', 'estilo', 'otro']),
  eje: Axis.nullable().describe('Solo para tipo espacio'),
  min: z.number().nullable().describe('Solo para tipo espacio, en mm'),
  max: z.number().nullable().describe('Solo para tipo espacio, en mm'),
})
export type Requirement = z.infer<typeof Requirement>

export function checkRequirements(design: Design, requirements: Requirement[]): DesignError[] {
  return requirements.flatMap((r) => {
    if (r.tipo !== 'espacio' || !r.eje) return []
    const measure = design.dimensiones[DIMENSION_OF_AXIS[r.eje]]
    const outside = (r.max !== null && measure > r.max) || (r.min !== null && measure < r.min)
    return outside ? [error('E_REQUISITO', `El ${DIMENSION_OF_AXIS[r.eje]} de ${measure} mm no respeta "${r.texto}".`, { requisito: r.id, medida: measure, min: r.min, max: r.max })] : []
  })
}

/** Adds or replaces by id, and drops the ones named. The shape of the change is the expert's. */
export function updateRequirements(current: Requirement[], changes: { agregar: Requirement[]; quitar: string[] }): Requirement[] {
  const next = new Map(current.filter((r) => !changes.quitar.includes(r.id)).map((r) => [r.id, r]))
  for (const r of changes.agregar) next.set(r.id, r)
  return [...next.values()]
}
