import { ASSUMPTIONS } from '../../assumptions'
import { MIN_DRAWER_OPENING_HEIGHT } from '../../editing/operations/drawer'
import type { Catalog } from '../../materials/catalog'
import { checkBuilt } from '../quick'
import type { CabinetPlan, PlanCell, PlanColumn } from './cabinet'
import { KICK_HEIGHT, thicknessOf } from './common'
import type { QuickCountKind } from './module'

// The quick counts of a cabinet: drawers, doors and open niches, read from the cells of its columns and changed by adding or removing one cell at a time.
// Adding splits a cell in two and the new half takes the kind; removing takes a cell out and its height goes to the neighbour. Every step is built and looked at.

export type QuickCounts = Record<QuickCountKind, number>

export const quickCounts = (plan: CabinetPlan): QuickCounts => {
  const cells = plan.columns.flatMap((c) => c.cells)
  return { drawer: cells.filter((c) => c.content === 'drawer').length, door: cells.filter((c) => c.content === 'door').length, open: cells.filter((c) => c.content === 'open').length }
}

const CONTENT: Record<QuickCountKind, PlanCell['content']> = { drawer: 'drawer', door: 'door', open: 'open' }
const cellCount = (plan: CabinetPlan) => plan.columns.reduce((n, c) => n + c.cells.length, 0)

/** The height under the box: what the base lifts it, which is not opening. */
const baseHeight = (plan: CabinetPlan) => (plan.base === 'kick' ? KICK_HEIGHT.cabinet : plan.base === 'legs' ? plan.legHeight : 0)

/** An opening's size in mm, from the plan alone: the room inside the box is shared by the column's cells by their heights, less the board between them. */
function openingSize(plan: CabinetPlan, catalog: Catalog, column: PlanColumn, height: number): { width: number; height: number } {
  const t = thicknessOf(catalog, plan.material)
  const total = plan.columns.reduce((s, c) => s + c.width, 0)
  const inside = plan.dimensions.height - baseHeight(plan) - 2 * t - (column.cells.length - 1) * t
  const stack = column.cells.reduce((s, c) => s + c.height, 0)
  return { width: (column.width / total) * (plan.dimensions.width - 2 * t - (plan.columns.length - 1) * t), height: (height / stack) * inside }
}

const fresh = (kind: QuickCountKind, width: number): PlanCell =>
  kind === 'drawer' ? { height: 1, content: 'drawer', shelves: null, doors: null } : kind === 'door' ? { height: 1, content: 'door', shelves: 0, doors: width > ASSUMPTIONS.doors.maxWidth ? 2 : 1 } : { height: 1, content: 'open', shelves: 0, doors: null }

/** The plan with one more cell of the kind, or null when no cell can give half: each half has to keep the lowest opening a drawer fits in. Open niches are split first, the tallest first. */
function grown(plan: CabinetPlan, kind: QuickCountKind, catalog: Catalog): CabinetPlan | null {
  const candidates = plan.columns.flatMap((column, i) => column.cells.map((cell, j) => ({ i, j, cell, size: openingSize(plan, catalog, column, cell.height) })))
  const ordered = [...candidates].sort((a, b) => Number(b.cell.content === 'open') - Number(a.cell.content === 'open') || b.size.height - a.size.height)
  for (const { i, j, cell, size } of ordered) {
    const half = cell.height / 2
    const kept: PlanCell = { ...cell, height: half, shelves: cell.shelves ? Math.floor(cell.shelves / 2) : cell.shelves }
    const added: PlanCell = { ...fresh(kind, size.width), height: half }
    const cells = plan.columns[i].cells.flatMap((x, m) => (m === j ? [kept, added] : [x]))
    const next = { ...plan, columns: plan.columns.map((c, n) => (n === i ? { ...c, cells } : c)) }
    if (openingSize(next, catalog, next.columns[i], half).height >= MIN_DRAWER_OPENING_HEIGHT) return next
  }
  return null
}

/** The plan without one cell of the kind, the smallest one, or null when it would leave no cell at all. */
function shrunk(plan: CabinetPlan, kind: QuickCountKind, catalog: Catalog): CabinetPlan | null {
  const found = plan.columns
    .flatMap((column, i) => column.cells.map((cell, j) => ({ i, j, cell, size: openingSize(plan, catalog, column, cell.height) })))
    .filter((c) => c.cell.content === CONTENT[kind])
    .sort((a, b) => a.size.height - b.size.height)[0]
  if (!found || cellCount(plan) === 1) return null
  const { i, j, cell } = found
  const column = plan.columns[i]
  if (column.cells.length === 1) return { ...plan, columns: plan.columns.filter((_, n) => n !== i) }
  const heir = j > 0 ? j - 1 : 1
  const cells = column.cells.flatMap((x, m) => (m === j ? [] : [m === heir ? { ...x, height: x.height + cell.height } : x]))
  return { ...plan, columns: plan.columns.map((c, n) => (n === i ? { ...c, cells } : c)) }
}

export type CountChange = { ok: true; plan: CabinetPlan; counts: QuickCounts } | { ok: false; plan: CabinetPlan; message: string; counts: QuickCounts }

/** One step up or down, built; the reason when it does not hold. */
function step(plan: CabinetPlan, kind: QuickCountKind, up: boolean, catalog: Catalog): { plan: CabinetPlan } | { message: string } {
  const next = up ? grown(plan, kind, catalog) : shrunk(plan, kind, catalog)
  if (!next) return { message: up ? 'Ya no hay un hueco con altura para partirlo en dos.' : 'Tiene que quedar al menos un hueco.' }
  const built = checkBuilt(next, catalog)
  return built.problems.length ? { message: built.problems[0] } : { plan: next }
}

/**
 * The plan with the count of a kind set to `target`, one cell at a time, each step built; it stops at the first that does not hold and gives back the plan as far as it got
 * with the reason. The kind's own cells are the ones counted: a door is a door cell, however many leaves it has.
 */
export function setCount(plan: CabinetPlan, kind: QuickCountKind, target: number, catalog: Catalog): CountChange {
  let current = plan
  while (quickCounts(current)[kind] !== target) {
    const result = step(current, kind, quickCounts(current)[kind] < target, catalog)
    if ('message' in result) return { ok: false, plan: current, message: result.message, counts: quickCounts(current) }
    current = result.plan
  }
  return { ok: true, plan: current, counts: quickCounts(current) }
}

export interface CountLimits {
  min: number
  max: number
}

/**
 * The fewest and the most of each kind the plan can have. The fewest is 0, or 1 when every cell is of that kind: the plan keeps at least one cell
 * (a column has at least one, and a cabinet at least one column). The most is the last count that adding one cell at a time still builds as asked:
 * a cell is only split while each half keeps the lowest opening a drawer fits in (MIN_DRAWER_OPENING_HEIGHT), and what the build says stops it too
 * (a drawer with no depth for a slide, a door too wide for two leaves).
 */
export function countLimits(plan: CabinetPlan, catalog: Catalog): Record<QuickCountKind, CountLimits> {
  const limits = {} as Record<QuickCountKind, CountLimits>
  for (const kind of ['drawer', 'door', 'open'] as const) {
    const now = quickCounts(plan)[kind]
    let max = now
    for (let current = plan; ; ) {
      const result = step(current, kind, true, catalog)
      if ('message' in result) break
      current = result.plan
      max = quickCounts(current)[kind]
    }
    limits[kind] = { min: now === cellCount(plan) ? 1 : 0, max }
  }
  return limits
}
