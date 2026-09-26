import type { Catalog } from '../../../domain/materials/catalog'
import adjust from '../prompts/adjust.v10.md?raw'
import planAdjust from '../prompts/plan-adjust.v12.md?raw'
import review from '../prompts/review.v5.md?raw'
import skeleton from '../prompts/skeleton.v15.md?raw'
import reading from '../prompts/reading.v3.md?raw'
import reconstruction from '../prompts/reconstruction.v12.md?raw'
import system from '../prompts/system.v11.md?raw'
import { FURNITURE_KINDS, MODULE_OF_KIND, type FurnitureKind } from '../../../domain/furniture/modules/plan'
import type { DesignKind } from '../../../domain/design/kind'
import { WRITTEN_BY_HAND, moduleGuide, modulePick, moduleSummary } from './modulePrompts'
import { fill } from './promptValues'

export interface Prompt {
  id: string
  /** As written, with its {{placeholders}}: send it through `render` or `systemFor`. */
  text: string
}

function read(raw: string): Prompt {
  const header = /^---\n([\s\S]*?)\n---\n/.exec(raw)
  const id = /id:\s*(\S+)/.exec(header?.[1] ?? '')?.[1] ?? 'no-id'
  return { id, text: raw.slice(header?.[0].length ?? 0).trim() }
}

const SYSTEM = read(system)
export const RECONSTRUCTION = read(reconstruction)
export const ADJUSTMENT = read(adjust)
export const PURCHASE_REVIEW = read(review)
/** Stands alone, without the system prompt: reading a photo needs no catalog or model rules. */
export const READING = read(reading)
/** Stands alone too, and a template by sections: the skeleton only needs the board thicknesses, filled in as {{materials}}. Sent through `skeletonFor`. */
export const SKELETON = readSections(skeleton)
/** Standalone as well, and a template: editing a plan needs only its own module, filled in by `planAdjustmentFor`. */
export const PLAN_ADJUSTMENT = read(planAdjust)

/** A prompt written in parts, each under a `# name` line: a template or a module file. */
export interface SectionedPrompt extends Prompt {
  sections: Record<string, string>
}

function readSections(raw: string): SectionedPrompt {
  const prompt = read(raw)
  const sections = Object.fromEntries(prompt.text.split(/^# /m).filter(Boolean).map((part) => [part.slice(0, part.indexOf('\n')).trim(), part.slice(part.indexOf('\n')).trim()]))
  return { ...prompt, sections }
}

const MODULE_FILES = import.meta.glob<string>('../prompts/modules/*.md', { query: '?raw', import: 'default', eager: true })

/** The prose written by hand for a module, tuned with `npm run compare`, by its kind. */
export const MODULE_PROMPTS = Object.fromEntries(Object.values(MODULE_FILES).map((raw) => readSections(raw)).map((m) => [m.id.split('@')[0], m])) as Partial<Record<FurnitureKind, SectionedPrompt>>

/** A module's parts of the prompts: its file when written by hand, otherwise generated from its schema (`@auto`: it follows the schema, not a version). */
function moduleParts(kind: FurnitureKind): { id: string; pick: string; skeleton: string; plan: string; changes: string; rules: string } {
  const file = WRITTEN_BY_HAND.includes(kind) ? MODULE_PROMPTS[kind] : undefined
  if (WRITTEN_BY_HAND.includes(kind) && !file) throw new Error(`The module ${kind} is written by hand and has no file in prompts/modules.`)
  if (!file) return { id: `${kind}@auto`, pick: modulePick(kind), skeleton: moduleGuide(kind), plan: moduleSummary(kind), changes: 'any field of its plan', rules: '' }
  const { pick, skeleton, plan, changes, rules } = file.sections
  return { id: file.id, pick, skeleton, plan, changes, rules: rules ?? '' }
}

const KIND_FILES = import.meta.glob<string>('../prompts/kinds/*.md', { query: '?raw', import: 'default', eager: true })

/** Short guides by use (a sideboard, a bookcase), written by hand from what the reference catalog taught: added after their module's own guide. */
export const KIND_PROMPTS = Object.fromEntries(Object.values(KIND_FILES).map((raw) => read(raw)).map((p) => [p.id.split('@')[0], p])) as Partial<Record<DesignKind, Prompt>>

/** The guide for this use of this module, if there is one. */
const guideFor = (module: FurnitureKind, use: DesignKind | null) => (use && MODULE_OF_KIND[use] === module ? KIND_PROMPTS[use] : undefined)

/** The hand-written modules first, as the prompts always listed them, then the generated ones. */
const LISTED = [...WRITTEN_BY_HAND, ...FURNITURE_KINDS.filter((kind) => !WRITTEN_BY_HAND.includes(kind))]

/**
 * The skeleton as sent. With the module the furniture is known to be, only that module: its line, its guide and its field.
 * Without one (the kind is unknown, or has no module), every module, as it always was: the expert picks.
 */
export function skeletonFor(kind: FurnitureKind | null, use: DesignKind | null = null): Prompt {
  const { intro, all, one, rest } = SKELETON.sections
  if (!kind) {
    const parts = LISTED.map(moduleParts)
    const text = [intro, all.replace('{{modulePicks}}', parts.map((p) => p.pick).join('\n')), ...parts.map((p) => p.skeleton), rest].join('\n\n')
    return { id: `${SKELETON.id}+all`, text }
  }
  const parts = moduleParts(kind)
  const guide = guideFor(kind, use)
  const text = [intro, one.replace('{{modulePick}}', parts.pick).replace('{{moduleField}}', kind), parts.skeleton, ...(guide ? [guide.text] : []), rest].join('\n\n')
  return { id: [SKELETON.id, parts.id, ...(guide ? [guide.id] : [])].join('+'), text }
}

/** The plan-adjust prompt for one module: the expert reads only the kind of plan it is editing. Its id names both parts. */
export function planAdjustmentFor(kind: FurnitureKind, use: DesignKind | null = null): Prompt {
  const parts = moduleParts(kind)
  const guide = guideFor(kind, use)
  const rules = parts.rules ? `\n${parts.rules.replace(/^/gm, '  ')}` : ''
  const text = PLAN_ADJUSTMENT.text.replace('{{module}}', guide ? `${parts.plan}\n\n${guide.text}` : parts.plan).replace('{{moduleChanges}}', parts.changes).replace('{{moduleField}}', kind).replace('{{moduleRules}}', rules)
  return { id: [PLAN_ADJUSTMENT.id, parts.id, ...(guide ? [guide.id] : [])].join('+'), text }
}

/** Every use with a guide of its own, with its module. */
const GUIDED = (Object.keys(KIND_PROMPTS) as DesignKind[]).map((use) => [MODULE_OF_KIND[use]!, use] as const)

/** Every prompt as sent, to check them all the same way: the skeleton for every module and without one, plan-adjust once per module, and both again with each guide. */
export const PROMPTS = [
  SYSTEM,
  RECONSTRUCTION,
  ADJUSTMENT,
  PURCHASE_REVIEW,
  READING,
  skeletonFor(null),
  ...FURNITURE_KINDS.map((kind) => skeletonFor(kind)),
  ...FURNITURE_KINDS.map((kind) => planAdjustmentFor(kind)),
  ...GUIDED.flatMap(([module, use]) => [skeletonFor(module, use), planAdjustmentFor(module, use)]),
]

/** The prompt as sent: every {{placeholder}} filled from the domain and, when given, the catalog. */
export const render = (prompt: Prompt, catalog: Catalog | null) => fill(prompt.text, catalog)

/** System + task: stable between calls to make the most of the provider's cache. */
export const systemFor = (task: Prompt, catalog: Catalog) => `${render(SYSTEM, catalog)}\n\n${render(task, catalog)}`
export const promptIdOf = (task: Prompt) => `${SYSTEM.id}+${task.id}`
