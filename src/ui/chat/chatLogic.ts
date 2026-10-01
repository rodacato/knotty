import { questionAnswerKey, type DesignState, type Message } from '../../domain/session/state'

export const SUGGESTIONS = ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Baja una repisa 10 cm', 'Refuerza la base']

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
export function suggestionsFor(state: DesignState, thinking: boolean): string[] {
  const last = state.chat.at(-1)
  if (thinking || state.tray.length || state.proposal || last?.author !== 'expert' || last.error) return []
  const offered = last.suggestions.length ? last.suggestions : state.versions.length <= 1 ? SUGGESTIONS : []
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
