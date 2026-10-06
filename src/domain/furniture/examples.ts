import type { Design } from '../design/schema'
import type { DesignKind } from '../design/kind'
import type { Catalog } from '../materials/catalog'
import type { FinishId } from '../materials/finishes'
import { buildPlan, type FurniturePlan } from './modules/plan'
import type { Reference, Room } from './references'

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
export type Base = Extract<Example, { plan: FurniturePlan }> & { id: string; rooms: Room[]; code: string; version: number; inspiredBy?: string }

const baseOf = (r: Reference): Base => ({
  id: r.id,
  code: r.code,
  version: r.version,
  rooms: r.rooms,
  name: r.name,
  notes: r.notes,
  plan: r.plan,
  ...(r.kind ? { kind: r.kind } : {}),
  ...(r.finish ? { finish: r.finish } : {}),
  ...(r.inspiredBy ? { inspiredBy: r.inspiredBy } : {}),
})

/** Every reference is a place to start, in the home screen's order. */
export const basesOf = (references: Reference[]): Base[] => references.map(baseOf)

/** The example's design, and the plan it comes from when it has one. */
export function exampleDesign(example: Example, catalog: Catalog): { design: Design; plan: FurniturePlan | null } {
  if ('design' in example) return { design: example.design, plan: null }
  const { design } = buildPlan(example.plan, catalog)
  return { design: { ...design, notes: example.notes, ...(example.finish ? { finish: example.finish } : {}), ...(example.kind ? { kind: example.kind } : {}) }, plan: example.plan }
}
