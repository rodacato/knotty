import type { Catalog } from '../../../domain/materials/catalog'
import adjust from '../prompts/adjust.v11.md?raw'
import planAdjust from '../prompts/plan-adjust.v12.md?raw'
import review from '../prompts/review.v5.md?raw'
import skeleton from '../prompts/skeleton.v16.md?raw'
import reading from '../prompts/reading.v4.md?raw'
import reconstruction from '../prompts/reconstruction.v14.md?raw'
import system from '../prompts/system.v11.md?raw'
import core from '../prompts/craft/core.v1.md?raw'
import tools from '../prompts/craft/tools.v1.md?raw'
import { adviceFor } from '../../../domain/furniture/knowledge/claims'
import type { KnowledgeSelection } from '../../../domain/furniture/knowledge/select'
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

/** The craft sense every expert call shares, by size (photo, short, full), and what the person's tools allow, by level. */
export const CRAFT_CORE = readSections(core)
export const CRAFT_TOOLS = readSections(tools)

/** The craft blocks a selection asks for; null without one. A photo reading gets only its own core. */
export function craftBlock(knowledge: KnowledgeSelection | null | undefined): Prompt | null {
  if (!knowledge) return null
  const withTools = knowledge.core !== 'photo' && knowledge.tools !== null
  const parts = [CRAFT_CORE.sections[knowledge.core], ...(withTools ? [CRAFT_TOOLS.sections[String(knowledge.tools)]] : [])]
  return { id: [CRAFT_CORE.id, ...(withTools ? [CRAFT_TOOLS.id] : [])].join('+'), text: parts.join('\n\n') }
}

const CLAIMS_ID = 'claims@1'

/** Workshop advice from the registry of known claims, in its own words and without ids; null when the call or the kind has none. */
export function claimsBlock(knowledge: KnowledgeSelection | null | undefined): Prompt | null {
  if (!knowledge) return null
  const advice = [...new Map(knowledge.advice.operations.flatMap((op) => adviceFor(knowledge.advice.use, op)).map((a) => [a.claimId, a])).values()]
  if (!advice.length) return null
  const lines = advice.map((a) => `- ${a.rule}${a.condition ? ` Applies when: ${a.condition}${a.missing ? ` Missing: ${a.missing}` : ''}` : ''}`)
  return { id: CLAIMS_ID, text: ['## Workshop practice', 'Guidance from general workshop practice, not a rule of the app and not a safety guarantee. Say it as advice with its condition, and do not present it as checked.', ...lines].join('\n') }
}

/** Last, after everything the prompt already said, so the prefix that cached before still does. */
function withCraft(prompt: Prompt, knowledge: KnowledgeSelection | null | undefined): Prompt {
  const craft = craftBlock(knowledge)
  if (!craft) return prompt
  const claims = claimsBlock(knowledge)
  return { id: [prompt.id, craft.id, ...(claims ? [claims.id] : [])].join('+'), text: [prompt.text, craft.text, ...(claims ? [claims.text] : [])].join('\n\n') }
}

export const readingFor = (knowledge?: KnowledgeSelection | null) => withCraft(READING, knowledge && { ...knowledge, core: 'photo', tools: null, advice: { use: null, operations: [] } })

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
export interface GuidePrompt extends Prompt {
  /** The `# short` section, for the calls that carry no module: null when the guide has none. `text` is the rest. */
  short: string | null
}

function readGuide(raw: string): GuidePrompt {
  const prompt = read(raw)
  const heading = /^# short[ \t]*\n/m.exec(prompt.text)
  if (!heading) return { ...prompt, short: null }
  return { id: prompt.id, text: prompt.text.slice(0, heading.index).trim(), short: prompt.text.slice(heading.index + heading[0].length).trim() }
}

export const KIND_PROMPTS = Object.fromEntries(Object.values(KIND_FILES).map((raw) => readGuide(raw)).map((p) => [p.id.split('@')[0], p])) as Partial<Record<DesignKind, GuidePrompt>>

/** The guide a selection asks for in the system-prompt calls, at its size; null when it has none or its file has no text of that size. */
export function guideBlock(use: DesignKind | null, size: KnowledgeSelection['guideSize']): Prompt | null {
  const guide = use && KIND_PROMPTS[use]
  const text = guide && (size === 'short' ? guide.short : guide.text)
  return guide && text ? { id: guide.id, text } : null
}

/** The guide for this use of this module, if there is one. */
const guideFor = (module: FurnitureKind, use: DesignKind | null) => (use && MODULE_OF_KIND[use] === module ? KIND_PROMPTS[use] : undefined)

/** The hand-written modules first, as the prompts always listed them, then the generated ones. */
const LISTED = [...WRITTEN_BY_HAND, ...FURNITURE_KINDS.filter((kind) => !WRITTEN_BY_HAND.includes(kind))]

/**
 * The skeleton as sent. With the module the furniture is known to be, only that module: its line, its guide and its field.
 * Without one (the kind is unknown, or has no module), every module, as it always was: the expert picks.
 */
export function skeletonFor(kind: FurnitureKind | null, use: DesignKind | null = null, knowledge?: KnowledgeSelection | null): Prompt {
  const { intro, all, one, rest } = SKELETON.sections
  if (!kind) {
    const parts = LISTED.map(moduleParts)
    const text = [intro, all.replace('{{modulePicks}}', parts.map((p) => p.pick).join('\n')), ...parts.map((p) => p.skeleton), rest].join('\n\n')
    return withCraft({ id: `${SKELETON.id}+all`, text }, knowledge)
  }
  const parts = moduleParts(kind)
  const guide = guideFor(kind, use)
  const text = [intro, one.replace('{{modulePick}}', parts.pick).replace('{{moduleField}}', kind), parts.skeleton, ...(guide ? [guide.text] : []), rest].join('\n\n')
  return withCraft({ id: [SKELETON.id, parts.id, ...(guide ? [guide.id] : [])].join('+'), text }, knowledge)
}

/** The plan-adjust prompt for one module: the expert reads only the kind of plan it is editing. Its id names both parts. */
export function planAdjustmentFor(kind: FurnitureKind, use: DesignKind | null = null, knowledge?: KnowledgeSelection | null): Prompt {
  const parts = moduleParts(kind)
  const guide = guideFor(kind, use)
  const rules = parts.rules ? `\n${parts.rules.replace(/^/gm, '  ')}` : ''
  const text = PLAN_ADJUSTMENT.text.replace('{{module}}', guide ? `${parts.plan}\n\n${guide.text}` : parts.plan).replace('{{moduleChanges}}', parts.changes).replace('{{moduleField}}', kind).replace('{{moduleRules}}', rules)
  return withCraft({ id: [PLAN_ADJUSTMENT.id, parts.id, ...(guide ? [guide.id] : [])].join('+'), text }, knowledge)
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
const withGuide = (prompt: Prompt, knowledge: KnowledgeSelection | null | undefined): Prompt => {
  const block = knowledge && knowledge.guide ? guideBlock(knowledge.guide, knowledge.guideSize) : null
  return block ? { id: `${prompt.id}+${block.id}`, text: `${prompt.text}\n\n${block.text}` } : prompt
}

/** The most specific text goes last: system, task, craft core and tools, then the guide of the use. */
export const systemFor = (task: Prompt, catalog: Catalog, knowledge?: KnowledgeSelection | null) => withGuide(withCraft({ id: '', text: `${render(SYSTEM, catalog)}\n\n${render(task, catalog)}` }, knowledge), knowledge).text
export const promptIdOf = (task: Prompt, knowledge?: KnowledgeSelection | null) => withGuide(withCraft({ id: `${SYSTEM.id}+${task.id}`, text: '' }, knowledge), knowledge).id
