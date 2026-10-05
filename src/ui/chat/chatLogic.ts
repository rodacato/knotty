import type { DesignKind } from '../../domain/design/kind'
import { questionAnswerKey, type DesignState, type Message } from '../../domain/session/state'

const STORAGE = ['Que mida 10 cm más de ancho', 'Agrégale una repisa', 'Ponle puertas', 'Refuerza la base']
const WITH_DRAWERS = ['Que mida 10 cm más de ancho', 'Agrégale un cajón', 'Súbele 5 cm a las patas', 'Que aguante más peso encima']
const TABLE = ['Que mida 75 cm de alto', 'Súmale 20 cm de largo', 'Que no se tambalee', 'Agrégale una repisa abajo']

/** What to ask first, by what the furniture is: a request that fits a bookcase means nothing on a bed. */
const STARTING_IDEAS: Record<DesignKind | 'unknown', string[]> = {
  bookcase: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Baja una repisa 10 cm', 'Refuerza la base'],
  cabinet: STORAGE,
  wardrobe: STORAGE,
  shoeRack: STORAGE,
  wallCabinet: ['Que mida 10 cm más de ancho', 'Agrégale una repisa', 'Ponle puertas', 'Que aguante platos pesados'],
  drawers: WITH_DRAWERS,
  nightstand: WITH_DRAWERS,
  sideboard: WITH_DRAWERS,
  tvStand: WITH_DRAWERS,
  bed: ['Que sea para colchón queen', 'Agrégale cajones abajo', 'Súbele 15 cm a la cabecera', 'Refuerza el centro de la base'],
  table: TABLE,
  desk: TABLE,
  diningTable: TABLE,
  coffeeTable: TABLE,
  sideTable: TABLE,
  workbench: TABLE,
  bench: ['Que mida 120 cm de largo', 'Que aguante a dos adultos', 'Agrégale una repisa abajo', 'Bájale 5 cm de alto'],
  unknown: ['Que mida 10 cm más de ancho', 'Que aguante más peso', 'Refuerza la base'],
}

export const startingIdeas = (kind: DesignKind | 'unknown') => STARTING_IDEAS[kind]

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** What the last failed attempt offers: send it again (connection), or put the request back in the box (the design was rejected). */
export function recovery(last: Message | undefined, previous: Message | undefined): 'retry' | 'edit' | null {
  if (!last?.error || previous?.author !== 'user') return null
  return last.failure === 'rejection' ? 'edit' : 'retry'
}

/** The label of the apply button: the plain one, or the quieter one under the fix button when the proposal still has critical findings. */
export const applyLabel = (criticalCount: number) => (criticalCount > 0 ? 'Aplicar así' : 'Aplicar')

/** Open questions with quick answers across the chat. */
export const openQuestions = (state: DesignState) =>
  state.chat.filter((m) => m.author === 'expert' && !m.answered).flatMap((m) => m.questions.filter((p, i) => p.options && !m.answers.includes(questionAnswerKey(i))))

/** The next steps worth offering: none while something waits for the person, and none already asked. */
export function suggestionsFor(state: DesignState, thinking: boolean, kind: DesignKind | 'unknown'): string[] {
  const last = state.chat.at(-1)
  if (thinking || state.tray.length || state.proposal || last?.author !== 'expert' || last.error) return []
  const offered = last.suggestions.length ? last.suggestions : state.versions.length <= 1 ? startingIdeas(kind) : []
  const asked = state.chat.filter((m) => m.author === 'user').map((m) => m.text)
  return offered.filter((s) => !asked.some((a) => same(a, s)))
}

/** What the person answered to a resolved question, read from the message that followed; null when it cannot be told. */
export function answerGiven(state: DesignState, m: Message, index: number): string | null {
  const options = m.questions[index]?.options ?? []
  const after = state.chat.slice(state.chat.indexOf(m) + 1).find((x) => x.author === 'user')
  if (!after) return null
  return options.find((o) => same(after.text, o)) ?? options.find((o) => after.text.includes(`${m.questions[index].text} ${o}`)) ?? null
}
