import type { Design, Dimensions } from '../design/schema'
import { analyze } from '../checks/analysis'
import type { Catalog } from '../materials/catalog'
import { estimatePurchase } from '../materials/purchase'
import { MEASURE_RANGE } from './typical'
import { buildPlan, moduleOf, type FurniturePlan } from './modules/plan'

// The quick adjust of a base: fit it to a space and sum up what it costs. Only a module that declares `quick` has something to ask.

const AXES = ['width', 'depth', 'height'] as const
type MeasureAxis = (typeof AXES)[number]

/** Measures are offered and searched in whole centimeters. */
const STEP = 10

export const isQuick = (plan: FurniturePlan) => moduleOf(plan).quick !== undefined

export interface BuiltCheck {
  design: Design
  /** What stops the plan from being a piece of furniture, or from coming out as asked; empty when it holds. */
  problems: string[]
  /** Critical findings of the structure review: the furniture stands, but the review would stop the purchase. */
  critical: string[]
}

/** The plan built and looked at: valid, built as asked, and what the structure review finds critical. */
export function checkBuilt(plan: FurniturePlan, catalog: Catalog): BuiltCheck {
  const { design } = buildPlan(plan, catalog)
  const analysis = analyze(design, catalog)
  if (!analysis.valid) return { design, problems: analysis.errors.map((e) => e.message), critical: [] }
  const missing = moduleOf(plan).quick?.builtAsAsked(plan, design)
  return { design, problems: missing ? [missing] : [], critical: analysis.findings.filter((f) => f.severity === 'critical').map((f) => f.message) }
}

const holds = (plan: FurniturePlan, catalog: Catalog) => checkBuilt(plan, catalog).problems.length === 0

const withAxis = (plan: FurniturePlan, axis: MeasureAxis, value: number, current: Dimensions) => moduleOf(plan).withMeasures(plan, { ...current, [axis]: value })

export interface MeasureLimits {
  min: number
  max: number
}

/**
 * How low and how high each measure can go with the others as they are, found by building the plan: the limit is the last measure, in whole cm,
 * at which the plan is still a valid piece of furniture built as asked (a drawer that no longer fits, a door that no longer hangs). The search assumes
 * that if a measure holds, every measure between it and the current one holds; the outer bounds are what Capture accepts (MEASURE_RANGE).
 * A plan that does not hold as it is has no room: both limits are its own measure.
 */
export function measureLimits(plan: FurniturePlan, catalog: Catalog, dimensions: Dimensions = dimensionsOf(plan, catalog)): Record<MeasureAxis, MeasureLimits> {
  const limits = {} as Record<MeasureAxis, MeasureLimits>
  const standing = holds(withMeasures(plan, dimensions), catalog)
  for (const axis of AXES) {
    const now = dimensions[axis]
    if (!standing) {
      limits[axis] = { min: now, max: now }
      continue
    }
    const [low, high] = MEASURE_RANGE[axis]
    const reach = (from: number, bound: number) => {
      const ok = (v: number) => holds(withAxis(plan, axis, v, dimensions), catalog)
      if (ok(bound)) return bound
      let [good, bad] = [from, bound]
      while (Math.abs(bad - good) > STEP) {
        const mid = Math.round((good + bad) / 2 / STEP) * STEP
        if (mid === good || mid === bad) break
        if (ok(mid)) good = mid
        else bad = mid
      }
      return good
    }
    limits[axis] = { min: reach(now, Math.ceil(low / STEP) * STEP), max: reach(now, Math.floor(high / STEP) * STEP) }
  }
  return limits
}

const pinned = (value: number): MeasureLimits => ({ min: value, max: value })

const withMeasures = (plan: FurniturePlan, dimensions: Dimensions) => moduleOf(plan).withMeasures(plan, dimensions)

/** The outside measures of a plan, as it is built. */
export function dimensionsOf(plan: FurniturePlan, catalog: Catalog): Dimensions {
  return buildPlan(plan, catalog).design.dimensions
}

export type AxisStatus = 'kept' | 'as-asked' | 'rounded-down' | 'raised' | 'lowered'

export interface AxisFit {
  /** What the space gave; null when it did not say this axis. */
  asked: number | null
  proposed: number
  min: number
  max: number
  /** kept: no space given; rounded-down: to whole cm; raised: the space is lower than the least this base can be; lowered: higher than the most. */
  status: AxisStatus
}

export interface SpaceFit {
  plan: FurniturePlan
  measures: Dimensions
  axes: Record<MeasureAxis, AxisFit>
  /** Every measure given is inside what the base allows, so nothing was raised or lowered. */
  insideLimits: boolean
  /** The proposed measures are no bigger than the space on any axis it gave. */
  fitsSpace: boolean
  /** What stops the proposed plan from being built as asked; empty when it holds. */
  problems: string[]
  critical: string[]
}

/**
 * The base taken to an approximate space in mm: each axis given takes the space rounded down to whole cm, never above it, and is held inside the limits
 * of the module (`measureLimits`). An axis not given keeps the base's own. A module with no quick measures gives the plan back as it is.
 */
export function fitToSpace(plan: FurniturePlan, space: Partial<Dimensions>, catalog: Catalog): SpaceFit {
  const current = dimensionsOf(plan, catalog)
  const fits = moduleOf(plan).quick?.measures === true
  const limits: Record<MeasureAxis, MeasureLimits> = fits ? measureLimits(plan, catalog, current) : { width: pinned(current.width), depth: pinned(current.depth), height: pinned(current.height) }
  const axes = {} as Record<MeasureAxis, AxisFit>
  for (const axis of AXES) {
    const asked = fits ? (space[axis] ?? null) : null
    const { min, max } = limits[axis]
    if (asked === null) {
      axes[axis] = { asked, proposed: current[axis], min, max, status: 'kept' }
      continue
    }
    const floor = Math.floor(asked / STEP) * STEP
    const proposed = Math.min(max, Math.max(min, floor))
    axes[axis] = { asked, proposed, min, max, status: floor < min ? 'raised' : floor > max ? 'lowered' : floor === asked ? 'as-asked' : 'rounded-down' }
  }
  const measures: Dimensions = { width: axes.width.proposed, depth: axes.depth.proposed, height: axes.height.proposed }
  const fitted = fits ? withMeasures(plan, measures) : plan
  const built = checkBuilt(fitted, catalog)
  const given = AXES.filter((a) => axes[a].asked !== null)
  return {
    plan: fitted,
    measures,
    axes,
    insideLimits: given.every((a) => axes[a].status !== 'raised' && axes[a].status !== 'lowered'),
    fitsSpace: given.every((a) => axes[a].proposed <= axes[a].asked!),
    problems: built.problems,
    critical: built.critical,
  }
}

export interface SheetSummary {
  material: string
  name: string
  thickness: number
  sheets: number
}

export type PlanSummary =
  | {
      ok: true
      sheets: SheetSummary[]
      totalSheets: number
      /** Sheets, hardware, edge banding and finish, in pesos. */
      cost: number
      /** What has no price in the catalog, so the cost is short by it. */
      missingPrices: string[]
    }
  | { ok: false; problems: string[] }

/** The sheets and the approximate cost of a plan, from the same estimate as the purchase list: `estimatePurchase` over the built design. */
export function summarizePlan(plan: FurniturePlan, catalog: Catalog, finish?: Design['finish']): PlanSummary {
  const { design: built } = buildPlan(plan, catalog)
  const design = finish ? { ...built, finish } : built
  const analysis = analyze(design, catalog)
  if (!analysis.valid) return { ok: false, problems: analysis.errors.map((e) => e.message) }
  const purchase = estimatePurchase(design, analysis.geo, catalog)
  const sheets = purchase.sheets.map((s) => ({ material: s.material.id, name: s.material.name, thickness: s.material.thickness, sheets: s.sheets }))
  return { ok: true, sheets, totalSheets: sheets.reduce((n, s) => n + s.sheets, 0), cost: purchase.cost.total, missingPrices: purchase.cost.missingPrices }
}
