import type { Catalog } from '../../../domain/materials/catalog'
import adjust from '../prompts/adjust.v10.md?raw'
import planAdjust from '../prompts/plan-adjust.v7.md?raw'
import review from '../prompts/review.v4.md?raw'
import skeleton from '../prompts/skeleton.v9.md?raw'
import reading from '../prompts/reading.v3.md?raw'
import reconstruction from '../prompts/reconstruction.v11.md?raw'
import system from '../prompts/system.v9.md?raw'

interface Prompt {
  id: string
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
/** Standalone as well: editing the ficha needs the board thicknesses, not the piece rules. */
export const PLAN_ADJUSTMENT = read(planAdjust)

function describeCatalog(c: Catalog) {
  return [
    'Materials:',
    ...c.materials.map((m) => `- ${m.id}: ${m.name}, ${m.thickness} mm (${m.type})`),
    'Hardware:',
    ...c.hardware.map((h) => `- ${h.id}: ${h.name}`),
  ].join('\n')
}

/** System + task: stable between calls to make the most of the provider's cache. */
export const systemFor = (task: Prompt, catalog: Catalog) => `${SYSTEM.text.replace('{{catalog}}', describeCatalog(catalog))}\n\n${task.text}`
export const promptIdOf = (task: Prompt) => `${SYSTEM.id}+${task.id}`
