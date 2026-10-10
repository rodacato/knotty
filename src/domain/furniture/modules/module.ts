import type { z } from 'zod'
import type { Axis, Design, Dimensions } from '../../design/schema'
import type { Catalog } from '../../materials/catalog'
import type { FieldSpec } from './fields'
import type { GuidePhase } from './guide'
import type { Parts } from './parts'

// What Knotty knows about one kind of furniture it builds by itself: adding a kind is writing one of these and listing it in MODULES.

/** The words for one choice of a plan, in the order the form shows them: `option` on its button, `phrase` inside a sentence, `hint` under it for someone who does not know the word. */
export type Labels<V extends string> = Record<V, { option: string; phrase: string; hint?: string }>

type Resized<P> = { ok: true; plan: P } | { ok: false; message: string }

/** What a module lets the person change fast, as the quick adjust of a base asks it. */
export type QuickCountKind = 'drawer' | 'door' | 'open'

/** A module declares what is quick; one with no `quick` has nothing the quick adjust can ask. */
export interface QuickSpec {
  /** Whether the outside measures can be fitted to a space. */
  measures: boolean
  /** The counts the person can change, from the cells of the plan. */
  counts: readonly QuickCountKind[]
}

/** What has to hold between the fields of a plan, beyond what its schema says of each one. */
export interface PlanRule<P> {
  holds(plan: P): boolean
  /** What the person reads when it does not. */
  message: string
  /** The field it is about. */
  path: string[]
}

export interface FurnitureModule<P extends { kind: string }> {
  kind: P['kind']
  schema: z.ZodType<P>
  /** Checked on every plan of its kind, in order; absent when the schema says it all. */
  rules?: PlanRule<P>[]
  /** What it is, with its article, for the person: "una cama". */
  label: string
  /** What the expert reads about it, in English: its field in the expert's schema and its section in the prompts come from here and from `schema`. */
  expert: {
    /** What it is, with its article: "a bed (a base with or without drawers, and a headboard)". */
    what: string
  }
  build(plan: P, catalog: Catalog): { design: Design; notes: string[] }
  /** What the plan asked for and the built design does not have, in words for the person; null when it came out as asked. Absent when its builder leaves nothing out. */
  builtAsAsked?(plan: P, design: Design): string | null
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
  /** The order it goes together in, for the page to take away; absent while its kind has no guide, and then the page shows none. */
  phases?(plan: P, design: Design): GuidePhase[]
  /** Every variant the bench builds with no expert: any that comes out invalid or with findings is a bug in Knotty. */
  benchVariants(): [string, P][]
  /** Its plan's form, section by section: the studio draws it, so a new kind needs no form of its own. */
  fields: FieldSpec<P>[]
  /** What is quick about it; absent for the kinds whose base has nothing to ask quickly. */
  quick?: QuickSpec
  /** Its parts: every field of its form belongs to one, and touching a piece opens its part. */
  parts: Parts<P>
}
