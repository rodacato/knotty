import type { Catalog } from '../../../domain/materials/catalog'
import adjust from '../prompts/adjust.v10.md?raw'
import planAdjust from '../prompts/plan-adjust.v9.md?raw'
import review from '../prompts/review.v5.md?raw'
import skeleton from '../prompts/skeleton.v11.md?raw'
import reading from '../prompts/reading.v3.md?raw'
import reconstruction from '../prompts/reconstruction.v12.md?raw'
import system from '../prompts/system.v10.md?raw'
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
/** Stands alone too: the skeleton only needs the board thicknesses, filled in as {{materials}}. */
export const SKELETON = read(skeleton)
/** Standalone as well: editing the plan needs the board thicknesses, not the piece rules. */
export const PLAN_ADJUSTMENT = read(planAdjust)

/** Every prompt, to check them all the same way. */
export const PROMPTS = [SYSTEM, RECONSTRUCTION, ADJUSTMENT, PURCHASE_REVIEW, READING, SKELETON, PLAN_ADJUSTMENT]

/** The prompt as sent: every {{placeholder}} filled from the domain and, when given, the catalog. */
export const render = (prompt: Prompt, catalog: Catalog | null) => fill(prompt.text, catalog)

/** System + task: stable between calls to make the most of the provider's cache. */
export const systemFor = (task: Prompt, catalog: Catalog) => `${render(SYSTEM, catalog)}\n\n${render(task, catalog)}`
export const promptIdOf = (task: Prompt) => `${SYSTEM.id}+${task.id}`
