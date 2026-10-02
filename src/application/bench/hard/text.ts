// Text helpers for the detectors: everything is compared accent-free and lower-case.

export const plain = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const sentencesOf = (text: string): string[] =>
  plain(text)
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

const NEGATION = /\b(no|ni|nunca|jamas|tampoco)\s+(?:[a-z]+\s+){0,3}$/
const DISCLAIMER = /\b(no|ni|nunca|jamas|tampoco)\b[^.!?\n,;:]*\b(decir|decirte|asegurar|asegurarte|garantizar|garantizarte|prometer|prometerte|afirmar|confirmar|certificar|saber|aprobar|puedo)\b[^.!?\n,;:]*$/
// «sí,» loses its accent in plain text; a «si» followed by a comma is the affirmation, not the condition.
const CONDITIONAL = /\b(si(?!\s*,)|cuando|despues de|solo si|siempre que|una vez que|antes de|en caso de|a menos que)\b/

/** The text before a match, up to the clause it sits in. */
const clauseBefore = (sentence: string, index: number): string => sentence.slice(0, index).split(/[,;:]/).at(-1) ?? ''

export type Context = 'asserted' | 'negated' | 'conditional'

/** How a match reads in its sentence: said outright, said with a negation right before it, or tied to a condition. */
export function contextOf(sentence: string, index: number): Context {
  const before = sentence.slice(0, index)
  if (NEGATION.test(clauseBefore(sentence, index)) || DISCLAIMER.test(before)) return 'negated'
  return CONDITIONAL.test(before) ? 'conditional' : 'asserted'
}

export interface Hit {
  match: string
  context: Context
}

/** Every match of the patterns, with how it reads; the sentence is searched in its accent-free form. */
export function hitsOf(text: string, patterns: RegExp[]): Hit[] {
  return sentencesOf(text).flatMap((sentence) =>
    patterns.flatMap((pattern) => [...sentence.matchAll(new RegExp(pattern.source, 'g'))].map((m) => ({ match: m[0], context: contextOf(sentence, m.index ?? 0) }))),
  )
}

/** Numbers as a person writes them: «1 234», «1.234,5», «4,26», «12.75». An ambiguous token gives every reading. */
export function numbersIn(text: string): number[] {
  const tokens = text.match(/\d{1,3}(?:[ .,  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g) ?? []
  return tokens.flatMap((token) => {
    const compact = token.replace(/[   ]/g, '')
    const readings = new Set<number>()
    const separators = compact.match(/[.,]/g)?.length ?? 0
    if (separators <= 1) readings.add(Number(compact.replace(',', '.')))
    if (separators >= 1 && /[.,]\d{3}(?![\d])/.test(compact)) readings.add(Number(compact.replace(/[.,]/g, '')))
    if (separators >= 2) {
      const last = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'))
      readings.add(Number(`${compact.slice(0, last).replace(/[.,]/g, '')}.${compact.slice(last + 1)}`))
    }
    return [...readings].filter(Number.isFinite)
  })
}
