import { z } from 'zod'
import type { DesignError } from '../validation/errors'

// What each call to the expert did, kept with the design so a person can see why something took long or failed.

export const TraceEntry = z.object({
  at: z.string(),
  step: z.enum(['read', 'plan', 'reconstruct', 'adjust', 'verdict']),
  /** What the call was about when there are several at once, like which photo. */
  subject: z.string().nullable().default(null),
  attempt: z.number().int().nonnegative(),
  seconds: z.number().nonnegative(),
  outputTokens: z.number().nullable(),
  promptId: z.string().nullable(),
  outcome: z.enum(['ok', 'invalid', 'unreadable', 'failed']),
  errors: z.array(z.object({ code: z.string(), message: z.string() })),
  /** What Knotty fixed by rule after this answer, in words for the person. */
  repairs: z.array(z.string()).default([]),
})
export type TraceEntry = z.infer<typeof TraceEntry>

const MAX_ENTRIES = 60

/** The subject of what Knotty did in the chat by itself: traced beside the expert's calls, with no prompt and no tokens. */
export const BY_KNOTTY = 'Knotty, sin experto'
export const byKnotty = (entry: TraceEntry) => entry.subject === BY_KNOTTY

export const appendTrace = (trace: TraceEntry[], entries: TraceEntry[]) => [...trace, ...entries].slice(-MAX_ENTRIES)

export const traceErrors = (errors: DesignError[]) => errors.map((e) => ({ code: e.code, message: e.message }))

/** Piece ids an error talks about, so the same problem is recognized after a partial fix. */
export function errorKey(e: DesignError) {
  const ids = Object.values(e.data ?? {})
    .filter((v): v is string => typeof v === 'string')
    .sort()
  return `${e.code}:${ids.join(',')}`
}

const PLAIN: Record<string, [string, string]> = {
  E_OVERLAP: ['una pieza encimada', 'piezas encimadas'],
  E_FLOATING: ['una pieza sin apoyo', 'piezas sin apoyo'],
  E_OVERALL_SIZE: ['una medida que no cierra', 'medidas que no cierran'],
  E_TOO_BIG_FOR_SHEET: ['una pieza más grande que la hoja', 'piezas más grandes que la hoja'],
  E_JOINT_WITHOUT_CONTACT: ['una unión entre piezas que no se tocan', 'uniones entre piezas que no se tocan'],
  E_SCHEMA: ['una respuesta con formato incorrecto', 'respuestas con formato incorrecto'],
  E_CYCLE: ['medidas que dependen unas de otras en círculo', 'medidas que dependen unas de otras en círculo'],
  E_REQUIREMENT: ['un requisito que no se cumple', 'requisitos que no se cumplen'],
}

/** "3 piezas encimadas y una pieza sin apoyo": the kinds of problem, for a person. */
export function describeProblems(errors: { code: string }[]) {
  const counts = new Map<string, number>()
  for (const e of errors) counts.set(e.code, (counts.get(e.code) ?? 0) + 1)
  const parts = [...counts].map(([code, n]) => {
    const [one, many] = PLAIN[code] ?? ['un problema de geometría', 'problemas de geometría']
    return n === 1 ? one : `${n} ${many}`
  })
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`
}
