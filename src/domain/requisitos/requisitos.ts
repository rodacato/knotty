import { z } from 'zod'
import { DIMENSION_DE_EJE, Eje, type Diseno } from '../diseno/esquema'
import { error, type ErrorDiseno } from '../validacion/errores'

// Hechos que expresó el usuario. Sobreviven a volver de versión: "mi espacio mide 90 cm" sigue siendo cierto.

export const Requisito = z.object({
  id: z.string().min(1).describe('Clave corta y estable, por ejemplo "espacio-ancho"'),
  texto: z.string().min(1).describe('Como lo diría el usuario: "Mi espacio mide 90 cm de ancho"'),
  tipo: z.enum(['espacio', 'carga', 'herramienta', 'estilo', 'otro']),
  eje: Eje.nullable().describe('Solo para tipo espacio'),
  min: z.number().nullable().describe('Solo para tipo espacio, en mm'),
  max: z.number().nullable().describe('Solo para tipo espacio, en mm'),
})
export type Requisito = z.infer<typeof Requisito>

export function verificarRequisitos(diseno: Diseno, requisitos: Requisito[]): ErrorDiseno[] {
  return requisitos.flatMap((r) => {
    if (r.tipo !== 'espacio' || !r.eje) return []
    const medida = diseno.dimensiones[DIMENSION_DE_EJE[r.eje]]
    const fuera = (r.max !== null && medida > r.max) || (r.min !== null && medida < r.min)
    return fuera ? [error('E_REQUISITO', `El ${DIMENSION_DE_EJE[r.eje]} de ${medida} mm no respeta "${r.texto}".`, { requisito: r.id, medida, min: r.min, max: r.max })] : []
  })
}

/** Agrega o reemplaza por id, y quita los indicados. */
export function actualizarRequisitos(actuales: Requisito[], cambios: { agregar: Requisito[]; quitar: string[] }): Requisito[] {
  const nuevos = new Map(actuales.filter((r) => !cambios.quitar.includes(r.id)).map((r) => [r.id, r]))
  for (const r of cambios.agregar) nuevos.set(r.id, r)
  return [...nuevos.values()]
}
