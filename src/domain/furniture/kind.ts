import type { Design } from '../design/schema'
import type { DesignKind, KindSource } from '../design/kind'
import { kindFromWords } from '../checks/typology/typology'
import { MODULE_OF_KIND, type FurniturePlan } from './modules/plan'
import { TABLE_KIND, type TablePlan } from './modules/table'

// What the furniture is and who said so. Everything that depends on the kind (the prompts, the checks by use) reads it from here, not from how the design came to be.

export type KnownKind = { kind: DesignKind; source: KindSource }

const RANK: Record<KindSource, number> = { person: 0, example: 1, plan: 1, photo: 2, words: 3 }

/** A module's own word ('cabinet', 'table'): it says the module, not the use. */
const isGeneric = (kind: DesignKind) => MODULE_OF_KIND[kind] === kind

/**
 * Which of two kinds the design keeps. The more trusted source wins, and the newer on a tie; nothing overrides the person but the person.
 * Within one module a use refines the module's own word: a cabinet plan and «librero» in the notes make a bookcase.
 */
export function settleKind(current: KnownKind | null, candidate: KnownKind | null): KnownKind | null {
  if (!candidate) return current
  if (!current) return candidate
  if (current.source === 'person' && candidate.source !== 'person') return current
  const module = MODULE_OF_KIND[current.kind]
  if (module && module === MODULE_OF_KIND[candidate.kind] && isGeneric(current.kind) !== isGeneric(candidate.kind)) return isGeneric(current.kind) ? candidate : current
  return RANK[candidate.source] <= RANK[current.source] ? candidate : current
}

/** The kind the design carries; one without a source was set by the module or example that built it. */
export const knownKind = (design: Pick<Design, 'kind' | 'kindSource'>): KnownKind | null => (design.kind ? { kind: design.kind, source: design.kindSource ?? 'plan' } : null)

export const withKind = (design: Design, known: KnownKind | null): Design => (known ? { ...design, kind: known.kind, kindSource: known.source } : design)

/** What the furniture is, for routing: what the design says, else what its name suggests, else unknown. */
export function kindOf(design: Pick<Design, 'name' | 'kind' | 'kindSource'>): KnownKind | { kind: 'unknown'; source: null } {
  const fromName = kindFromWords(design.name)
  return knownKind(design) ?? (fromName ? { kind: fromName, source: 'words' } : { kind: 'unknown', source: null })
}

/** What a new design is, from everything known at the start: the plan it came from, the person's choice, the photos and the words. */
export function startingKind(sources: { person: DesignKind | null; built: KnownKind | null; photo: string | null; words: string }): KnownKind | null {
  const photo = sources.photo ? kindFromWords(sources.photo) : null
  const words = kindFromWords(sources.words)
  return [
    words && { kind: words, source: 'words' as const },
    photo && { kind: photo, source: 'photo' as const },
    sources.built,
    sources.person && { kind: sources.person, source: 'person' as const },
  ].reduce<KnownKind | null>((kept, next) => settleKind(kept, next || null), null)
}

/**
 * What changing the kind does: nothing if it already is; in place if the plan (or the lack of one) still fits; a new design if the plan is another module's.
 * A plan of one module cannot become another: a bookcase's columns say nothing about a bed.
 */
export function kindChange(design: Design, plan: FurniturePlan | null, kind: DesignKind): 'same' | 'in-place' | 'redo' {
  if (design.kind === kind && design.kindSource === 'person') return 'same'
  if (!plan) return 'in-place'
  return MODULE_OF_KIND[kind] === plan.kind ? 'in-place' : 'redo'
}

/** A plan the person changed by hand that changes the kind (a table's use) is their choice. */
export const byPerson = (before: Design, after: Design): Design => (after.kind && after.kind !== before.kind ? { ...after, kindSource: 'person' } : after)

/** The expert's plan keeps the kind the person chose: it may not turn their desk into a dining table. */
export const keepPersonKind = (plan: FurniturePlan, design: Design): FurniturePlan => (design.kindSource === 'person' && design.kind ? planForKind(plan, design.kind) : plan)

const TABLE_USE = Object.fromEntries(Object.entries(TABLE_KIND).map(([use, kind]) => [kind, use])) as Partial<Record<DesignKind, TablePlan['use']>>

/** The plan saying the same as the kind: a table's use is its kind, so choosing «escritorio» makes it a desk. Other plans do not say their use. */
export function planForKind(plan: FurniturePlan, kind: DesignKind): FurniturePlan {
  const use = TABLE_USE[kind]
  return plan.kind === 'table' && use ? { ...plan, use } : plan
}
