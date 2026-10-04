import { z } from 'zod'
import { hasRouter, type ToolLevel } from './tools'

// The shape of an exposed edge's arris, from docs/carpinteria/acabados.md §11.1. The straight edge is the absence of one.

export const EDGE_PROFILE_IDS = ['eased', 'roundover-3', 'roundover-6', 'chamfer'] as const
export const EdgeProfileId = z.enum(EDGE_PROFILE_IDS)
export type EdgeProfileId = z.infer<typeof EdgeProfileId>

export interface EdgeProfile {
  name: string
  /** Tools and what it shows on plywood, for the person. */
  detail: string
  /** Null when it is not a radius (a chamfer). */
  radius: number | null
  /** Only a router makes it; a lumberyard can do it instead (§11.1). */
  router: boolean
  /** Cut with a bit or a plane: it cannot go over veneer edge banding (§11.2). */
  cut: boolean
}

export const EDGE_PROFILES: Record<EdgeProfileId, EdgeProfile> = {
  eased: { name: 'Matar arista a mano', detail: 'r ≈ 1 mm · taco de lija', radius: 1, router: false, cut: false },
  'roundover-3': { name: 'Redondeo 3 mm', detail: 'Router con broca de balero, o lija · muestra una línea de capa', radius: 3, router: false, cut: true },
  'roundover-6': { name: 'Redondeo 6 mm', detail: 'Router · en pino de 18 mm deja a la vista 2–3 capas', radius: 6, router: true, cut: true },
  chamfer: { name: 'Chaflán', detail: 'Router, cepillo o lija · franjas rectas de capas', radius: null, router: false, cut: true },
}

/** What the reference recommends on every exposed edge: it is what an edge gets when the person first picks it. */
export const DEFAULT_EDGE_PROFILE: EdgeProfileId = 'eased'

export type ProfileFit = { ok: true } | { ok: false; reason: 'router' } | { ok: false; reason: 'thin'; minThickness: number }

/** The thinnest board it fits: the radius cannot pass half the thickness (§11.1). */
const minThicknessFor = (id: EdgeProfileId) => 2 * (EDGE_PROFILES[id].radius ?? 0)

/** Whether the person can make it on a board this thick with their tools. */
export function profileFit(id: EdgeProfileId, level: ToolLevel, thickness: number): ProfileFit {
  if (thickness < minThicknessFor(id)) return { ok: false, reason: 'thin', minThickness: minThicknessFor(id) }
  if (EDGE_PROFILES[id].router && !hasRouter(level)) return { ok: false, reason: 'router' }
  return { ok: true }
}
