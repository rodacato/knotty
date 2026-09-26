import type { CutLine } from '../../domain/materials/cutList'
import type { Finding } from '../../domain/structure/finding'
import type { DesignError } from '../../domain/validation/errors'
import type { Check } from '../../domain/viability/viability'
import { describeAlternatives } from '../context'

// Text the expert reads (in English, like the prompts): corrections and the purchase review.

export const listErrors = (errors: DesignError[]) => errors.map((e) => `- ${e.code}: ${e.message}${e.data ? ` ${JSON.stringify(e.data)}` : ''}`).join('\n')

/** For the extra round: the change is valid, but these new critical findings need a fix or a question. */
export const criticalsCorrection = (criticals: Finding[]) =>
  [
    'The change is valid but leaves these new critical structural problems:',
    ...criticals.map((h) => `- ${h.code} ${h.pieces.join(', ')}: ${h.message} Alternatives: ${describeAlternatives(h)}`),
    'If the fix is clear, include it in the operations. If there is a choice to make, keep the requested operations and offer the options in questions.',
  ].join('\n')

/** For the plan's correction round: the plan was read but Knotty cannot build a valid design from it. */
export const planCorrection = (errors: DesignError[]) =>
  [
    'Knotty built the design from your plan and it is not valid:',
    listErrors(errors),
    'Fix the plan so it builds, keeping the change the person asked for, and return the complete plan.',
  ].join('\n')

const CHECK_STATE = { ok: 'ok', warning: 'warning', fail: 'FAIL' }
export function reviewText(cut: CutLine[], checks: Check[]) {
  return [
    '## Cut list (length × width × thickness, mm)',
    ...cut.map((r) => `- ${r.count} × ${r.name} (${r.material}): ${r.length} × ${r.width} × ${r.thickness}`),
    '',
    '## App checks',
    ...checks.map((c) => `- [${CHECK_STATE[c.status]}] ${c.title}: ${c.detail}`),
  ].join('\n')
}
