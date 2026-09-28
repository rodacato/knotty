import type { Catalog } from '../../domain/materials/catalog'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import { findSavings as search, type SavingSearch } from '../../domain/furniture/saving/saving'
import type { DesignState } from '../../domain/session/state'
import { currentPlan } from './currentPlan'
import type { Kit } from './kit'

/** «Ahorrar material» from the plan sheet: the locks the person sets, and the search over what they left free. */
export function createSaving(kit: Kit) {
  const { catalog, save } = kit

  const lockField = (state: DesignState, key: string, locked: boolean): DesignState => save({ ...state, locks: { ...state.locks, [key]: locked } })

  /** Searched on the plan as it stands in the sheet, with the expert's changes on top and the cutting settings of Materiales. */
  function findSavings(state: DesignState, plan: FurniturePlan, layoutCatalog: Catalog = catalog): SavingSearch {
    const current = currentPlan(state)
    return search(plan, { catalog: layoutCatalog, extras: current.diverged ? [] : current.extras, requirements: state.requirements, overrides: state.locks })
  }

  return { lockField, findSavings }
}
