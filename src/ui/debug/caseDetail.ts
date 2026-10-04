import type { BenchResult, CallStep } from '../../application/bench/bench'
import type { Outcome } from '../../application/bench/cases'

// A case result read as a story: what was asked, what the expert did with it, and what the grader checked.

const OUTCOME: Record<Outcome, string> = {
  applied: 'aplicó el cambio',
  pending: 'dejó una propuesta sin aplicar',
  answer: 'contestó sin cambiar el diseño',
  rejected: 'no logró aplicarlo',
  error: 'error del experto o de la conexión',
}

const CALL: Record<CallStep, string> = {
  skeleton: 'esqueleto',
  pieces: 'piezas',
  'plan-adjust': 'ajuste de la ficha',
  adjust: 'ajuste',
  review: 'revisión',
  reading: 'lectura de fotos',
}

export interface StepView {
  label: string
  /** What was asked; null for the first step, which is the case's own request. */
  request: string | null
  outcome: string
  /** The design the step left: measures, pieces and the review's verdict. */
  design: string
  checks: { status: 'pass' | 'fail' | 'unknown'; text: string }[]
}

export const caseSteps = (r: BenchResult): StepView[] =>
  (r.steps ?? []).map((s) => ({
    label: s.label,
    request: s.request,
    outcome: OUTCOME[s.outcome],
    design: s.design.valid ? `${s.design.measures} mm · ${s.design.pieces} piezas · ${s.design.verdict}` : `diseño inválido: ${s.design.problems.join(' ') || 'sin detalle'}`,
    checks: s.expectations.map((e) => ({ status: e.status, text: `${e.detail}${e.subject === 'proposal' ? ' (propuesta pendiente)' : ''}${e.status === 'unknown' && !e.mandatory ? ' (no se puede evaluar)' : ''}` })),
  }))

/** One line per call to the expert: what for, how long, how many tokens. */
export const callLines = (r: BenchResult): string[] =>
  r.callLog.map((c) => {
    const tokens = c.input !== null || c.output !== null ? ` · ${c.input?.toLocaleString('es-MX') ?? '?'} tokens de entrada, ${c.output?.toLocaleString('es-MX') ?? '?'} de salida` : ''
    return `${CALL[c.step]} · ${c.seconds.toFixed(1)} s${tokens}`
  })
