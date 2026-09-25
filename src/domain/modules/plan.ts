import { z } from 'zod'
import type { Design } from '../design/schema'
import type { Catalog } from '../materials/catalog'
import { BedPlan, buildBed } from './bed'
import { buildCabinet, CabinetPlan } from './cabinet'
import { buildTable, TablePlan } from './table'

// The ficha of any piece of furniture Knotty builds by itself. Plans saved before beds existed have no kind: they are cabinets.

export const FurniturePlan = z.union([BedPlan, TablePlan, CabinetPlan])
export type FurniturePlan = z.infer<typeof FurniturePlan>

export const isBed = (plan: FurniturePlan): plan is BedPlan => 'kind' in plan && plan.kind === 'bed'
export const isTable = (plan: FurniturePlan): plan is TablePlan => 'kind' in plan && plan.kind === 'table'

export function buildPlan(plan: FurniturePlan, catalog: Catalog): { design: Design; notes: string[] } {
  return isBed(plan) ? buildBed(plan, catalog) : isTable(plan) ? buildTable(plan, catalog) : buildCabinet(plan, catalog)
}

