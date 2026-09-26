import { z } from 'zod'

// What needs the expert's judgment waits here and goes in one request: a minute per request, not per decision.

export const TrayItem = z.object({
  /** One item per origin: choosing another answer or alternative for the same thing replaces it. */
  id: z.string(),
  kind: z.enum(['notice', 'answer', 'suggestion']),
  /** What the expert reads, one line. */
  text: z.string().min(1),
  /** What the person sees in the tray, short. */
  label: z.string().min(1),
  /** For an answer: the question it answers, as "messageId#p0", so it is marked answered when sent. */
  answers: z.string().nullable().default(null),
})
export type TrayItem = z.infer<typeof TrayItem>

export const noticeItemId = (noticeKey: string) => `notice:${noticeKey}`
export const answerItemId = (messageId: string, index: number) => `answer:${messageId}#p${index}`

/** Adds the item, or replaces the one with the same origin; the same item again takes it out. */
export function toggleInTray(tray: TrayItem[], item: TrayItem): TrayItem[] {
  const same = tray.find((i) => i.id === item.id)
  if (same && same.text === item.text) return tray.filter((i) => i.id !== item.id)
  return same ? tray.map((i) => (i.id === item.id ? item : i)) : [...tray, item]
}

/** The tray and what the person typed, as one message for the expert, with the questions it answers. */
export function trayRequest(tray: TrayItem[], typed = ''): { text: string; answers: string | null } {
  const lines = [...tray.map((i) => i.text), typed.trim()].filter(Boolean)
  const answers = tray.flatMap((i) => (i.answers ? [i.answers] : []))
  return {
    text: lines.length === 1 ? lines[0] : `Te mando todo junto:\n${lines.map((l, n) => `${n + 1}. ${l}`).join('\n')}`,
    answers: answers.length ? answers.join(';') : null,
  }
}

export const answerItem = (messageId: string, index: number, question: string, option: string): TrayItem => ({
  id: answerItemId(messageId, index),
  kind: 'answer',
  text: `${question} ${option}`,
  label: option,
  answers: `${messageId}#p${index}`,
})

export const suggestionItem = (text: string): TrayItem => ({ id: `suggestion:${text}`, kind: 'suggestion', text, label: text, answers: null })
