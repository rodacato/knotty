import { compareRuns, trialsOfRows, type CaseComparison, type Comparison, type Status, type TrialRecord } from './classify'
import type { KnownFailure } from './knownFailures'
import type { ManifestIdentity } from './manifest'
import type { PromotedBaseline } from './promote'
import type { Baseline } from './report'

// «Contra la base»: a run against the saved baseline, only as far as the two can be shown to be the same measurement.

export interface Candidate {
  manifest: ManifestIdentity
  trials: TrialRecord[]
}

export interface Standing {
  /** Verified: the baseline carries an identity and it is compatible. Unverified: a legacy baseline, compared by case only. */
  kind: 'verified' | 'unverified' | 'incompatible'
  comparison: Comparison | null
  /** At least one requirement got worse than the baseline allows: the run exits 1. */
  regression: boolean
  reasons: string[]
  lines: string[]
}

const LABEL: Record<Status, string> = {
  same: 'igual',
  regression: 'REGRESIÓN',
  improvement: 'mejora',
  known: 'falla conocida (sigue fallando)',
  variation: 'variación',
  new: 'nuevo',
  retired: 'retirado',
  incompatible: 'incompatible (el caso cambió)',
  unmeasured: 'sin medir',
}

const identityOf = (baseline: Baseline | PromotedBaseline): ManifestIdentity | null => ('identity' in baseline ? baseline.identity : null)

const requirement = (id: string) => (id === 'case' ? 'caso completo' : id)

const tally = (t: { passed: number; counted: number } | null) => (t ? `${t.passed}/${t.counted}` : '—')

const cell = (text: string) => text.replace(/\|/g, '/')

function wholeCase(c: CaseComparison): CaseComparison {
  const whole = c.requirements.filter((r) => r.id === 'case')
  return whole.length ? { ...c, status: whole[0].status, requirements: whole } : c
}

function caseRow(c: CaseComparison, benchCases: string[] | null): string {
  const notRun = c.status === 'retired' && !!benchCases && benchCases.includes(c.caseId)
  const label = notRun ? 'no corrido en esta corrida' : LABEL[c.status]
  const changed = c.requirements.filter((r) => r.status !== 'same').map((r) => `${requirement(r.id)}: ${LABEL[r.status]} (${tally(r.base)} → ${tally(r.candidate)})`)
  return `| ${c.caseId} | ${label} | ${cell(changed.join('; ')) || '—'} |`
}

const heading = (baseline: Baseline) => `Base: «${baseline.label}», commit ${baseline.commit}, ${baseline.date.slice(0, 16).replace('T', ' ')} UTC.`

/** `benchCases` are today's case ids: a base case that still exists but was not run is «no corrido», not retired. */
export function standingAgainst(baseline: Baseline | PromotedBaseline, candidate: Candidate, options: { known: KnownFailure[]; benchCases?: string[] }): Standing {
  const identity = identityOf(baseline)
  const base = { manifest: identity ?? candidate.manifest, trials: trialsOfRows(baseline.rows, options.known) }
  const comparison = compareRuns(base, candidate)
  if (!comparison.compatible) {
    return { kind: 'incompatible', comparison: null, regression: false, reasons: comparison.reasons, lines: ['## Contra la base', '', heading(baseline), '', `No se compara: la base y esta corrida no midieron lo mismo (${comparison.reasons.join('; ')}).`, ''] }
  }

  const kind = identity ? 'verified' : 'unverified'
  // A legacy base has no steps: only the case as a whole can be compared, and the candidate's step requirements are not «new» news.
  const cases = identity ? comparison.cases : comparison.cases.map((c) => wholeCase(c))
  const worse = cases.flatMap((c) => c.requirements.filter((r) => r.status === 'regression').map((r) => `${c.caseId} ${requirement(r.id)}`))
  const count = (s: Status) => cases.filter((c) => c.status === s).length
  const { added, retired, changed } = comparison.caseDiffs
  const infra = comparison.infrastructure.map((i) => `${i.side === 'base' ? 'base' : 'esta corrida'} ${i.caseId} t${i.trial}${i.error ? ` (${cell(i.error).slice(0, 80)})` : ''}`)
  const lines = [
    '## Contra la base',
    '',
    heading(baseline),
    kind === 'verified' ? 'Comparación verificada: mismo calificador, prompts, esquemas, catálogo y experto.' : 'SIN VERIFICAR: la base no trae identidad (es de antes de los manifiestos). Se compara solo por caso; no se sabe si el calificador, los prompts o los casos eran los mismos.',
    '',
    `Resultado: ${worse.length} requisitos en regresión · ${count('improvement')} casos mejoran · ${count('known')} con falla conocida · ${count('variation')} con variación · ${count('same')} iguales`,
    ...(worse.length ? [`Regresiones: ${worse.join(', ')}`] : []),
    ...(added.length || retired.length || changed.length ? [`Casos nuevos: ${added.join(', ') || 'ninguno'} · retirados: ${retired.join(', ') || 'ninguno'} · cambiados (no se comparan): ${changed.join(', ') || 'ninguno'}`] : []),
    '',
    '| Caso | Estado | Requisitos que cambiaron |',
    '|---|---|---|',
    ...cases.map((c) => caseRow(c, options.benchCases ?? null)),
    ...(infra.length ? ['', `Infraestructura (fuera de las tasas): ${infra.join('; ')}`] : []),
    '',
  ]
  return { kind, comparison, regression: worse.length > 0, reasons: [], lines }
}
