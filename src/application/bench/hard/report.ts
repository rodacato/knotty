import type { Classification } from '../manifest'
import type { Evaluation } from './evaluate'
import type { Exchange } from './scenario'
import type { SupportDecision } from './types'

// What the hard suite prints and files. The run's report and summary carry ids only; the answers live in the review queue, in the run's ignored directory.

export interface HardJobOutcome {
  jobId: string
  questionId: string
  trial: number
  status: 'done' | 'failed' | 'cancelled'
  evaluation?: Evaluation
  classification?: Classification | null
  exchanges?: Exchange[]
  error?: string
  seconds: number
}

export interface Declared {
  questionId: string
  support: SupportDecision
}

export const HARD_EXIT = { ok: 0, regression: 1, incomplete: 2 } as const

const blocked = (o: HardJobOutcome) => o.evaluation?.verdict === 'blocked'

/** A blocking failure is a regression and never averaged away; a run with answers waiting for a person is not complete. */
export function hardExitCode(outcomes: HardJobOutcome[]): number {
  if (outcomes.some((o) => o.classification === 'regression')) return HARD_EXIT.regression
  const waiting = outcomes.some((o) => o.status !== 'done' || o.classification === 'infrastructure' || o.evaluation?.verdict === 'review')
  return waiting ? HARD_EXIT.incomplete : HARD_EXIT.ok
}

const MARK: Record<string, string> = { pass: '✓', review: '?', fail: '×', blocked: '×', infrastructure: '!' }
const LABEL: Record<string, string> = { pass: 'pasa', review: 'revisión humana', fail: 'falla', blocked: 'BLOQUEADO', infrastructure: 'infraestructura' }

export function progressLine(o: HardJobOutcome): string {
  const name = `${o.questionId} t${o.trial}`
  if (o.status === 'cancelled') return `  - ${name} → cancelado`
  if (o.status === 'failed' || !o.evaluation) return `  ! ${name} → no terminó: ${o.error ?? 'sin mensaje'}`
  const verdict = o.evaluation.verdict
  const fired = [...new Set(o.evaluation.checks.filter((k) => k.status === 'fail').map((k) => k.id))]
  const known = o.classification === 'known-failure' ? ' (falla conocida, sigue fallando)' : ''
  return `  ${MARK[verdict]} ${name} → ${LABEL[verdict]}${known}${fired.length ? ` · ${fired.join(', ')}` : ''}`
}

export const declaredLines = (declared: Declared[]): string[] =>
  declared.map((d) => `  ${d.support.status === 'unsupported' ? '∅' : '~'} ${d.questionId} → ${d.support.status === 'unsupported' ? 'no soportada' : 'soporte parcial'} (${d.support.reason ?? 'sin motivo'})`)

export interface HardFacts {
  runId: string
  label: string
  spec: string
  outcomes: HardJobOutcome[]
  declared: Declared[]
  resultsPath: string
}

export function hardSummary(f: HardFacts): string {
  const count = (verdict: string) => f.outcomes.filter((o) => o.evaluation?.verdict === verdict).length
  const unfinished = f.outcomes.filter((o) => o.status !== 'done').length
  const blockedIds = [...new Set(f.outcomes.filter(blocked).map((o) => o.questionId))]
  const unsupported = f.declared.filter((d) => d.support.status === 'unsupported')
  return [
    `Corrida ${f.runId} · «${f.label}» · ${f.spec} · suite difícil`,
    ...(blockedIds.length ? [`BLOQUEADA: fallo bloqueante en ${blockedIds.join(', ')}. Ningún promedio lo compensa.`, ''] : []),
    ...f.outcomes.map(progressLine),
    '',
    `Resumen: ${count('pass')} pasan · ${count('review')} esperan revisión humana · ${count('fail')} fallan · ${count('blocked')} bloqueados · ${count('infrastructure')} de infraestructura · ${unfinished} sin terminar`,
    `Declaradas: ${unsupported.length} no soportadas, ${f.declared.length - unsupported.length} con soporte parcial`,
    ...declaredLines(f.declared),
    ...(count('review') + count('fail') + count('blocked') ? ['', 'Cola de revisión humana: review-queue.md (en la carpeta de la corrida, fuera de git). Ningún resultado crítico o ambiguo pasa solo.'] : []),
    '',
    `Reporte: ${f.resultsPath}`,
  ].join('\n')
}

/** Ids and counts only. */
export function hardReport(f: HardFacts): string {
  const byQuestion = [...new Set(f.outcomes.map((o) => o.questionId))]
  return [
    `# Suite difícil · ${f.runId}`,
    '',
    `Etiqueta: ${f.label} · experto: ${f.spec}`,
    ...(f.outcomes.some(blocked) ? ['', '**BLOQUEADA**: hay al menos un fallo bloqueante; ningún promedio lo compensa.'] : []),
    '',
    '| Pregunta | Pruebas | Veredictos | Revisan | Bloqueantes |',
    '|---|---|---|---|---|',
    ...byQuestion.map((id) => {
      const mine = f.outcomes.filter((o) => o.questionId === id)
      const verdicts = mine.map((o) => o.evaluation?.verdict ?? o.status).join(', ')
      const fired = [...new Set(mine.flatMap((o) => o.evaluation?.checks.filter((k) => k.blocking).map((k) => k.id) ?? []))]
      return `| ${id} | ${mine.length} | ${verdicts} | ${mine.filter((o) => o.evaluation?.verdict === 'review').length} | ${fired.join(', ') || '—'} |`
    }),
    '',
    '## Declaradas',
    '',
    ...(f.declared.length ? f.declared.map((d) => `- ${d.questionId}: ${d.support.status} (${d.support.reason ?? '—'})`) : ['Ninguna.']),
    '',
  ].join('\n')
}

/** The one file that carries answer text: critical, ambiguous and failing results wait here for a person. */
export function reviewQueueMarkdown(runId: string, outcomes: HardJobOutcome[]): string {
  const queued = outcomes.filter((o) => o.evaluation && o.evaluation.verdict !== 'pass' && o.evaluation.verdict !== 'infrastructure')
  return [
    `# Cola de revisión humana · ${runId}`,
    '',
    'Privado: lleva el texto de las respuestas. Vive en la carpeta ignorada de la corrida y no se copia a ningún archivo de git.',
    '',
    ...(queued.length ? [] : ['Nada espera revisión.', '']),
    ...queued.flatMap((o) => {
      const e = o.evaluation!
      const fired = e.checks.filter((k) => k.status !== 'pass').map((k) => `${k.id}@${k.turn}:${k.status}${k.blocking ? ' (bloqueante)' : ''}`)
      return [
        `## ${o.questionId} · prueba ${o.trial} · ${o.jobId}`,
        '',
        `Veredicto automático: ${e.verdict} · motivos: ${e.reviewReasons.join(', ') || '—'}`,
        `Comprobaciones disparadas: ${fired.join(', ') || 'ninguna'}`,
        '',
        ...(o.exchanges ?? []).flatMap((x, i) => [`Turno ${i + 1}, la persona:`, '', quote(x.request), '', `Turno ${i + 1}, el asesor:`, '', quote(x.answer), '']),
      ]
    }),
  ].join('\n')
}

const quote = (text: string) => text.split('\n').map((l) => `> ${l}`).join('\n')
