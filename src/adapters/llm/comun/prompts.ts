import type { Catalog } from '../../../domain/materiales/catalog'
import ajuste from '../prompts/ajuste.v9.md?raw'
import ajusteFicha from '../prompts/ajuste-ficha.v5.md?raw'
import dictamen from '../prompts/dictamen.v3.md?raw'
import esqueleto from '../prompts/esqueleto.v7.md?raw'
import lectura from '../prompts/lectura.v2.md?raw'
import reconstruccion from '../prompts/reconstruccion.v9.md?raw'
import sistema from '../prompts/sistema.v6.md?raw'

interface Prompt {
  id: string
  text: string
}

function read(raw: string): Prompt {
  const header = /^---\n([\s\S]*?)\n---\n/.exec(raw)
  const id = /id:\s*(\S+)/.exec(header?.[1] ?? '')?.[1] ?? 'sin-id'
  return { id, text: raw.slice(header?.[0].length ?? 0).trim() }
}

const SYSTEM = read(sistema)
export const RECONSTRUCTION = read(reconstruccion)
export const ADJUSTMENT = read(ajuste)
export const PURCHASE_REVIEW = read(dictamen)
/** Stands alone, without the system prompt: reading a photo needs no catalog or model rules. */
export const READING = read(lectura)
/** Stands alone too: the skeleton only needs the board thicknesses, filled in as {{materiales}}. */
export const SKELETON = read(esqueleto)
/** Standalone as well: editing the ficha needs the board thicknesses, not the piece rules. */
export const PLAN_ADJUSTMENT = read(ajusteFicha)

function describeCatalog(c: Catalog) {
  return [
    'Materiales:',
    ...c.materiales.map((m) => `- ${m.id}: ${m.nombre}, ${m.espesor} mm (${m.tipo})`),
    'Herrajes:',
    ...c.herrajes.map((h) => `- ${h.id}: ${h.nombre}`),
  ].join('\n')
}

/** System + task: stable between calls to make the most of the provider's cache. */
export const systemFor = (task: Prompt, catalog: Catalog) => `${SYSTEM.text.replace('{{catalogo}}', describeCatalog(catalog))}\n\n${task.text}`
export const promptIdOf = (task: Prompt) => `${SYSTEM.id}+${task.id}`
