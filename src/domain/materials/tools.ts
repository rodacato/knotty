import { z } from 'zod'

// The tools the person has, in the three levels of docs/carpinteria/fabricacion-y-armado.md §1.1. It is the person's, not the design's.

export const TOOL_LEVELS = [1, 2, 3] as const
export const ToolLevel = z.union([z.literal(1), z.literal(2), z.literal(3)])
export type ToolLevel = z.infer<typeof ToolLevel>

/** Until the person says otherwise, the safest assumption: cuts made at the store and a drill. */
export const DEFAULT_TOOL_LEVEL: ToolLevel = 1

/** `name` on its option, `short` after «Tu herramienta:», `tools` what the level adds (§1.1). */
export const TOOL_LEVEL_LABELS: Record<ToolLevel, { name: string; short: string; tools: string }> = {
  1: { name: 'Cortes en tienda + taladro', short: 'cortes en tienda + taladro', tools: 'Taladro atornillador, avellanador, escuadra, prensas, martillo y lija.' },
  2: { name: 'Intermedio', short: 'intermedio', tools: 'Lo anterior más sierra circular con guía, plantilla de bolsillo y broca de 35 mm.' },
  3: { name: 'Taller completo', short: 'taller completo', tools: 'Lo anterior más sierra de mesa, router y prensas largas.' },
}

/** The router with its bits comes at level 3 (§1.1). */
export const hasRouter = (level: ToolLevel) => level >= 3
