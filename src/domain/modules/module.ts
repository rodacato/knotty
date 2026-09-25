import type { z } from 'zod'
import type { Axis, Design, Dimensions } from '../design/schema'
import type { Catalog } from '../materials/catalog'

// What Knotty knows about one kind of furniture it builds by itself: adding a kind is writing one of these and listing it in MODULES.

/** The words for one choice of a plan, in the order the form shows them: `option` on its button, `phrase` inside a sentence. */
export type Labels<V extends string> = Record<V, { option: string; phrase: string }>

export type Resized<P> = { ok: true; plan: P } | { ok: false; message: string }

export interface FurnitureModule<P extends { kind: string }> {
  kind: P['kind']
  schema: z.ZodType<P>
  /** What it is, with its article, for the person: "una cama". */
  label: string
  build(plan: P, catalog: Catalog): { design: Design; notes: string[] }
  /** What changed, in words for the person and for the expert's context. */
  describeChanges(before: P, after: P): string[]
  /** The whole piece grows or shrinks along one axis, through its plan. */
  resize(plan: P, axis: Axis, value: number): Resized<P>
  /** The plan with the outside measures the person gave, where the plan takes them. */
  withMeasures(plan: P, measures: Dimensions): P
  /** The header line under its name. */
  summary(plan: P, dimensions: Dimensions): string
  /** Why its measures are what they are, when they come from the plan and not from the person; null otherwise. */
  measuresNote(plan: P, dimensions: Dimensions): string | null
  /** A few words for the trace: "Cama individual". */
  traceLabel(plan: P): string
  /** Every variant the bench builds with no expert: any that comes out invalid or with findings is a bug in Knotty. */
  benchVariants(): [string, P][]
}
