import { reviewSignature } from '../../application/useCases/review'
import { wallOf } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import { currentDesign, type DesignState } from '../../domain/session/state'

export function reviewNotes(state: DesignState, catalog: Catalog): string[] {
  const design = currentDesign(state)
  const review = state.review?.signature === reviewSignature(state, catalog) ? state.review : null
  const notes = review ? [
    ...(review.verdict === 'not-viable' ? ['Este diseño no es viable: no compres ni cortes con esta lista.'] : review.verdict === 'needs-changes' ? ['Este diseño necesita cambios antes de comprar o cortar.'] : []),
    ...review.checks.filter((check) => check.status !== 'ok').map((check) => `${check.title}: ${check.detail}`),
    ...(review.carpenter?.problems.filter((problem) => review.verdict !== 'viable' || problem.severity !== 'low').map((problem) => `${problem.title}: ${problem.detail}`) ?? []),
    ...(review.error ? ['El experto no respondió. La revisión incluye solamente las comprobaciones de Knotty.'] : []),
  ] : ['Este diseño no tiene una revisión vigente. Revísalo en Materiales antes de comprar o cortar.']
  if (design.wallAnchored && wallOf(design) === 'unknown') notes.push('Falta identificar el muro: la lista no incluye los taquetes que le corresponden. Confírmalos antes de comprar.')
  return notes
}
