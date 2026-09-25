import { z } from 'zod'
import type { DesignKind } from '../design/kind'
import type { Catalog } from '../materials/catalog'
import { BedPlan, bedModule } from './bed'
import { CabinetPlan, cabinetModule } from './cabinet'
import type { FurnitureModule } from './module'
import { TablePlan, tableModule } from './table'

// The ficha of any piece of furniture Knotty builds by itself, and the module that knows each kind.

export const FurniturePlan = z.discriminatedUnion('kind', [CabinetPlan, BedPlan, TablePlan])
export type FurniturePlan = z.infer<typeof FurniturePlan>
export type FurnitureKind = FurniturePlan['kind']
type PlanOf<K extends FurnitureKind> = Extract<FurniturePlan, { kind: K }>

/** One module per kind, in the order the bench shows them; the type fails to compile if a kind has none. */
export const MODULES: { [K in FurnitureKind]: FurnitureModule<PlanOf<K>> } = { bed: bedModule, table: tableModule, cabinet: cabinetModule }

/** The module that builds each kind of furniture; null when Knotty has no ficha for it and the expert designs it piece by piece. */
export const MODULE_OF_KIND: Record<DesignKind, FurnitureKind | null> = {
  cabinet: 'cabinet', bookcase: 'cabinet', wardrobe: 'cabinet', wallCabinet: 'cabinet', shoeRack: 'cabinet', drawers: 'cabinet', nightstand: 'cabinet',
  bed: 'bed',
  table: 'table', desk: 'table', diningTable: 'table', coffeeTable: 'table', sideTable: 'table',
  bench: null,
}

/** The module of a plan: the lookup by its kind always gives the module of that same plan, which the type system cannot follow. */
export const moduleOf = <P extends FurniturePlan>(plan: P) => MODULES[plan.kind] as unknown as FurnitureModule<P>

export const buildPlan = (plan: FurniturePlan, catalog: Catalog) => moduleOf(plan).build(plan, catalog)

/** What changed between two plans, in words for the person and for the expert's context. */
export function describePlanChanges(before: FurniturePlan, after: FurniturePlan): string[] {
  if (before.kind !== after.kind) return [`ahora es ${MODULES[after.kind].label}`]
  return moduleOf(before).describeChanges(before, after)
}
