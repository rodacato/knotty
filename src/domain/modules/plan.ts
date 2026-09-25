import { z } from 'zod'
import type { Diseno } from '../diseno/esquema'
import type { Catalogo } from '../materiales/catalogo'
import { BedPlan, buildBed } from './bed'
import { buildCabinet, CabinetPlan } from './cabinet'

// The ficha of any piece of furniture Knotty builds by itself. Plans saved before beds existed have no kind: they are cabinets.

export const FurniturePlan = z.union([BedPlan, CabinetPlan])
export type FurniturePlan = z.infer<typeof FurniturePlan>

export const isBed = (plan: FurniturePlan): plan is BedPlan => 'kind' in plan && plan.kind === 'bed'

export function buildPlan(plan: FurniturePlan, catalog: Catalogo): { design: Diseno; notes: string[] } {
  return isBed(plan) ? buildBed(plan, catalog) : buildCabinet(plan, catalog)
}

