import type { PurchaseReview } from './state'

export interface PurchaseReviewItem {
  id: string
  title: string
  detail: string
  pieces: string[]
  request: string | null
  optional: boolean
  priority: 'high' | 'medium' | 'low'
  source: 'expert' | 'check'
}

export function purchaseReviewItems(review: PurchaseReview): PurchaseReviewItem[] {
  const items: PurchaseReviewItem[] = (review.carpenter?.problems ?? []).map((problem, index) => ({
    ...problem,
    id: `expert:${index}`,
    priority: problem.severity,
    optional: problem.severity === 'low' && review.verdict === 'viable',
    source: 'expert',
  }))
  for (const check of review.checks.filter((check) => check.status !== 'ok' && check.id !== 'accepted')) {
    if (check.id === 'structure' && check.status === 'warning' && review.carpenter?.problems.length) continue
    if (check.request && items.some((item) => item.request === check.request && item.detail === check.detail)) continue
    items.push({ ...check, id: `check:${check.id}`, optional: check.status === 'warning' && ['margin', 'structure'].includes(check.id), priority: check.status === 'fail' ? 'high' : 'medium', source: 'check' })
  }
  if (!items.length && review.verdict !== 'viable') items.push({ id: 'summary', title: 'Consultar los cambios necesarios', detail: review.carpenter?.summary ?? 'La revisión pide cambios, pero no detalla cómo hacerlos. Consulta al experto antes de comprar o cortar.', pieces: [], request: null, priority: 'high', optional: false, source: 'expert' })
  return items
}
