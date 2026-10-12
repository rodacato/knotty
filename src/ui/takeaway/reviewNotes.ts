import { reviewSignature } from '../../application/useCases/review'
import { wallOf } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import { purchaseReviewItems } from '../../domain/session/purchaseReview'
import { currentDesign, type DesignState } from '../../domain/session/state'

const DECISIONS = {
  requested: 'Solicitaste una consulta o ajuste; todavía no confirma una corrección.',
  keep: 'Decidiste mantener el diseño sin esta mejora.',
  risk: 'Decidiste mantenerlo bajo tu riesgo; el problema no está corregido.',
}

export function reviewNotes(state: DesignState, catalog: Catalog): string[] {
  const design = currentDesign(state)
  const review = state.review?.signature === reviewSignature(state, catalog) ? state.review : null
  const notes: string[] = []
  if (!review) notes.push('Este diseño no tiene una revisión vigente. Revísalo en Materiales antes de comprar o cortar.')
  else {
    const choices = new Map((review.choices ?? []).map((entry) => [entry.id, entry.choice]))
    const included = new Set<string>()
    const add = (id: string, title: string, detail: string) => {
      included.add(id)
      const choice = choices.get(id)
      notes.push(`${title}: ${detail}${choice ? ` ${DECISIONS[choice]}` : ''}`)
    }
    if (review.verdict === 'not-viable') notes.push('Este diseño no es viable: no compres ni cortes con esta lista.')
    else if (review.verdict === 'needs-changes') notes.push('Este diseño necesita cambios antes de comprar o cortar.')
    for (const check of review.checks.filter((check) => check.status !== 'ok')) add(`check:${check.id}`, check.title, check.detail)
    review.carpenter?.problems.forEach((problem, index) => {
      if (review.verdict !== 'viable' || problem.severity !== 'low') add(`expert:${index}`, problem.title, problem.detail)
    })
    for (const item of purchaseReviewItems(review)) {
      if (choices.has(item.id) && !included.has(item.id)) add(item.id, item.title, item.detail)
    }
    if (review.error) notes.push('El experto no respondió. La revisión incluye solamente las comprobaciones de Knotty.')
  }
  if (design.wallAnchored && wallOf(design) === 'unknown') notes.push('Falta identificar el muro: la lista no incluye los taquetes que le corresponden. Confírmalos antes de comprar.')
  return notes
}
