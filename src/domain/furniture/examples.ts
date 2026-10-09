import type { Design } from '../design/schema'
import type { DesignKind } from '../design/kind'
import type { Catalog } from '../materials/catalog'
import type { FinishId } from '../materials/finishes'
import { buildPlan, type FurniturePlan } from './modules/plan'
import type { Reference, Room, Style } from './references'

// What the person can start from: a ready design, or a plan Knotty builds (a base), so the plan sheet and the local requests work from the first click.

export type Example =
  | { name: string; design: Design }
  | {
      name: string
      plan: FurniturePlan
      /** What the example is, for the person: the builder leaves a plan's design without notes. */
      notes: string
      finish?: FinishId
      /** What it is, since a cabinet plan does not say it. */
      kind?: DesignKind
      /** The ficha it is, at its version, when it is one. */
      code?: string
      version?: number
    }

/** A starting point on the home screen: always a plan, so the ficha edits it without the expert. Its `code` is KC-… when it was checked against a catalog product and GN-… when it is generic (`references/`). */
export type Base = Extract<Example, { plan: FurniturePlan }> & { id: string; rooms: Room[]; style: Style; code: string; version: number; inspiredBy?: string }

/** A reference as something to open: its plan with what the ficha says of it, or its own design under the ficha's name, notes, kind and finish. */
export function exampleOf(r: Reference): Example {
  const said = { ...(r.kind ? { kind: r.kind } : {}), ...(r.finish ? { finish: r.finish } : {}) }
  if (r.plan) return { name: r.name, plan: r.plan, notes: r.notes, code: r.code, version: r.version, ...said }
  return { name: r.name, design: { ...r.design!, name: r.name, notes: r.notes, ...said } }
}

/** The references with a plan are the places to start, in the home screen's order; one that is a design has no screen that opens it. */
export const basesOf = (references: Reference[]): Base[] =>
  references.flatMap((r) => (r.plan ? [{ id: r.id, code: r.code, version: r.version, rooms: r.rooms, style: r.style, name: r.name, notes: r.notes, plan: r.plan, ...(r.kind ? { kind: r.kind } : {}), ...(r.finish ? { finish: r.finish } : {}), ...(r.inspiredBy ? { inspiredBy: r.inspiredBy } : {}) }] : []))

/** The example's design, and the plan it comes from when it has one. */
export function exampleDesign(example: Example, catalog: Catalog): { design: Design; plan: FurniturePlan | null } {
  if ('design' in example) return { design: example.design, plan: null }
  const { design } = buildPlan(example.plan, catalog)
  return { design: { ...design, notes: example.notes, ...(example.finish ? { finish: example.finish } : {}), ...(example.kind ? { kind: example.kind } : {}) }, plan: example.plan }
}
