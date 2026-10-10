import { TERMS, type Term } from '../glossary'

// Paper has no tap: the trade words a page uses are explained at its end, and only the ones it uses.

const ON_PAPER = [TERMS.apron, TERMS.kick, TERMS.stretcher, TERMS.subfront, TERMS.banding, TERMS.camLock, TERMS.edge] as const

/** Without accents: «faldón» loses its own in the plural. */
const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

/** The terms whose word is in these texts, whole and in any case, plural or not. */
export function wordsIn(texts: string[]): Term[] {
  const page = plain(texts.join(' '))
  return ON_PAPER.filter((term) => new RegExp(`(^|[^a-z])${plain(term.name)}(s|es)?($|[^a-z])`).test(page))
}
