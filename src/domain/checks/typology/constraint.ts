import type { Design } from '../../design/schema'
import type { Box, Geometry } from '../../design/resolve'
import type { DesignKind } from '../../design/kind'
import type { Finding, RuleContext, Severity } from '../structure/finding'

// A check by kind of furniture as data: a measure with a minimum or a maximum is read by the evaluator; anything else brings its own function.

export type Limit = number | readonly [number, number]
export type Limits = Readonly<Record<string, Limit>>
/** Below `min` or above `max`, a finding; other limits only go in the message. */
export type MetricLimits = Limits & { readonly min?: number; readonly max?: number }

/** Where the limits come from: a section of docs/carpinteria and the row that has them, or why there is none. */
export type Source = `docs/carpinteria/${string}.md#${string}` | `no reference: ${string}`

/** What the furniture is used on: its top, its seat or its platform. */
export interface Surface {
  ids: string[]
  box: Box
}

export interface UseInput extends RuleContext {
  use: DesignKind
  /** Null when the kind has no surface, or the design has none big enough. */
  surface: Surface | null
}

interface ConstraintBase<L extends Limits> {
  /** Part of the finding's key ('wardrobe.depth'): renaming it shows again the findings the person accepted. */
  check: string
  appliesTo: readonly DesignKind[]
  limits: L
  source: Source
}

export type Metric = 'width' | 'height' | 'depth' | 'surfaceHeight'

export interface MetricConstraint<L extends MetricLimits = MetricLimits> extends ConstraintBase<L> {
  metric: Metric
  severity: Severity
  /** Furniture anchored to the wall does not need it. */
  unlessAnchored?: boolean
  /** For the person, in Spanish. */
  message(value: number, limits: L): string
  data?(value: number, limits: L): Finding['data']
  alternatives?: Finding['alternatives']
}

/** A finding of this check, with its code and check id filled in. */
export type Report = (severity: Severity, pieces: string[], message: string, data?: Finding['data'], alternatives?: Finding['alternatives']) => Finding

export interface FunctionConstraint<L extends Limits = Limits> extends ConstraintBase<L> {
  find(input: UseInput, limits: L, report: Report): Finding[]
}

export type CategoryConstraint = MetricConstraint | FunctionConstraint

export const measured = <const L extends MetricLimits>(constraint: MetricConstraint<L>): MetricConstraint<L> => constraint
export const checked = <const L extends Limits>(constraint: FunctionConstraint<L>): FunctionConstraint<L> => constraint

/** The smallest area, in m², a level of horizontal pieces needs to count as the surface of each kind that has one. */
const SURFACE_AREA: Partial<Record<DesignKind, number>> = { bed: 0.6, desk: 0.25, diningTable: 0.1, coffeeTable: 0.1, sideTable: 0.1, bench: 0.05 }

const horizontal = (design: Design, geo: Geometry) =>
  design.pieces.filter((p) => p.normal === 'y' && !p.group && geo.boxes.has(p.id)).map((p) => ({ piece: p, box: geo.boxes.get(p.id)! }))
const area = (b: Box) => ((b.x1 - b.x0) * (b.z1 - b.z0)) / 1e6

/** The work or sleeping surface: the highest level where horizontal pieces add up to the most area. */
function topSurface(design: Design, geo: Geometry, minArea: number): Surface | null {
  const levels = new Map<number, { area: number; ids: string[]; box: Box }>()
  for (const { piece, box } of horizontal(design, geo)) {
    if (area(box) < 0.05) continue
    const y = Math.round(box.y1)
    const level = levels.get(y) ?? { area: 0, ids: [], box: { ...box } }
    level.area += area(box)
    level.ids.push(piece.id)
    level.box = { x0: Math.min(level.box.x0, box.x0), x1: Math.max(level.box.x1, box.x1), y0: Math.min(level.box.y0, box.y0), y1: y, z0: Math.min(level.box.z0, box.z0), z1: Math.max(level.box.z1, box.z1) }
    levels.set(y, level)
  }
  return [...levels.entries()].filter(([, l]) => l.area >= minArea).sort(([ya], [yb]) => yb - ya)[0]?.[1] ?? null
}

/** Kinds whose surface carries a person: a load that comes and goes (docs/carpinteria/valores-de-referencia.md §5 «Persona»). */
const PERSON_KINDS: readonly DesignKind[] = ['bed', 'bench']

/** The pieces a person lies or sits on, in a kind that has them; empty otherwise. */
export function personSurface(ctx: RuleContext, use: DesignKind | null): ReadonlySet<string> {
  const minArea = use && PERSON_KINDS.includes(use) ? SURFACE_AREA[use] : undefined
  return new Set(minArea === undefined ? [] : (topSurface(ctx.design, ctx.geo, minArea)?.ids ?? []))
}

function measure(metric: Metric, { design, surface }: UseInput): { value: number; pieces: string[] } | null {
  if (metric !== 'surfaceHeight') return { value: design.dimensions[metric], pieces: [] }
  return surface ? { value: surface.box.y1, pieces: surface.ids } : null
}

function evaluateMetric(c: MetricConstraint, input: UseInput, report: Report): Finding[] {
  const measurement = measure(c.metric, input)
  if (!measurement || (c.unlessAnchored && input.design.wallAnchored)) return []
  const { value, pieces } = measurement
  const { min, max } = c.limits
  const outside = (min !== undefined && value < min) || (max !== undefined && value > max)
  return !outside ? [] : [report(c.severity, pieces, c.message(value, c.limits), c.data?.(value, c.limits), c.alternatives)]
}

/** Every entry that applies to this kind of furniture, in the order of the list. */
export function evaluateConstraints(constraints: readonly CategoryConstraint[], ctx: RuleContext, use: DesignKind | null): Finding[] {
  if (!use) return []
  const applicable = constraints.filter((c) => c.appliesTo.includes(use))
  if (!applicable.length) return []
  const minArea = SURFACE_AREA[use]
  const input: UseInput = { ...ctx, use, surface: minArea === undefined ? null : topSurface(ctx.design, ctx.geo, minArea) }
  return applicable.flatMap((c) => {
    const report: Report = (severity, pieces, message, data = {}, alternatives = []) => ({ code: 'R10_USE', severity, pieces, check: c.check, message, data, alternatives })
    return 'find' in c ? c.find(input, c.limits, report) : evaluateMetric(c, input, report)
  })
}
