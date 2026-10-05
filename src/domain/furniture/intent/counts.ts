import type { Design } from '../../design/schema'
import { error, type DesignError } from '../../design/validation/errors'
import { COUNT, countOf, normalize } from './intent'

// How many doors and drawers a description asks for, to check the plan the expert returned against it.
// Like the rest of intent/, a count read two ways is not a count: then that part is not checked.

export type Part = 'doors' | 'drawers'
export type PartCounts = Record<Part, number | null>

const NOUN: Record<Part, string> = { doors: String.raw`puert(?:a|as|ita|itas)`, drawers: String.raw`cajon(?:es|cito|citos)?` }
/** Words that make a count of doors say leaves or sides instead of pieces. */
const NOT_PIECES: Record<Part, RegExp> = { doors: /\b(dobles?|hojas?)\b/, drawers: /\b(cada lado|por lado|de lado y lado|ambos lados)\b/ }

function asked(text: string, part: Part): number | null {
  const mentions = [...text.matchAll(new RegExp(String.raw`\b${NOUN[part]}\b`, 'g'))]
  if (!mentions.length || NOT_PIECES[part].test(text)) return null
  if (new RegExp(String.raw`\bsin ${NOUN[part]}\b`).test(text)) return mentions.length === 1 ? 0 : null
  let total = 0
  for (const m of mentions) {
    const said = new RegExp(String.raw`(?:^|\s)(${COUNT})\s$`).exec(text.slice(0, m.index))
    if (!said) return null
    total += countOf(said[1])
  }
  return total
}

/** Every mention added up: «abajo tres puertas y a la derecha dos cajones; arriba un cajoncito» is 3 doors and 3 drawers, «sin puertas» is none. Null for a part not said, or said without a plain count («con puertas», «cajones 3», «puertas dobles»). */
export function askedParts(description: string): PartCounts {
  const text = normalize(description)
  return { doors: asked(text, 'doors'), drawers: asked(text, 'drawers') }
}

/** Doors and drawers by their pieces, so a design piece by piece counts too. */
export const designParts = (design: Pick<Design, 'pieces'>): Record<Part, number> => ({
  doors: design.pieces.filter((p) => p.role === 'door').length,
  drawers: design.pieces.filter((p) => p.role === 'drawer-front').length,
})

export type PartsMismatch = { part: Part; asked: number; found: number }[]

/** The parts the design has in another number than asked. */
export function partsMismatch(asked: PartCounts, design: Pick<Design, 'pieces'>): PartsMismatch {
  const found = designParts(design)
  return (Object.keys(asked) as Part[]).flatMap((part) => (asked[part] !== null && asked[part] !== found[part] ? [{ part, asked: asked[part]!, found: found[part] }] : []))
}

const WORD: Record<Part, [string, string]> = { doors: ['puerta', 'puertas'], drawers: ['cajón', 'cajones'] }
const said = (n: number, part: Part) => `${n} ${n === 1 ? WORD[part][0] : WORD[part][1]}`

/** What differs, for the expert's correction round and the person: «Se pidieron 2 puertas y la ficha tiene 4.» */
export const describeMismatch = (mismatch: PartsMismatch) => mismatch.map((m) => `Se ${m.asked === 1 ? 'pidió' : 'pidieron'} ${said(m.asked, m.part)} y la ficha tiene ${m.found}.`).join(' ')

/** The mismatch as an error to send back: each door opening brings its own leaves, which is where most extra doors come from. */
export const partsError = (mismatch: PartsMismatch): DesignError =>
  error('E_PARTS', `${describeMismatch(mismatch)} Cada hueco con puerta lleva sus propias hojas: deja exactamente las puertas y los cajones que se pidieron.`, { mismatch })
