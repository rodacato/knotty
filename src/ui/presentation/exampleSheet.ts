import { analyze } from '../../domain/checks/analysis'
import { counterLines } from '../../domain/estimate/counterList'
import type { MaterialLayout } from '../../domain/estimate/layout'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { exampleDesign, exampleOf } from '../../domain/furniture/examples'
import type { Reference } from '../../domain/furniture/references'
import type { Catalog } from '../../domain/materials/catalog'
import { lineNumbers } from '../studio/copyListLabels'

export type ExampleSheet = { a: MaterialLayout; index: number; total: number; numbers: Map<string, number>; chosen: string }

/** The sheet where Knotty places one piece of an example, as the Materials screen draws it; null when the example does not build or has no such piece. */
export function exampleSheet(reference: Reference, catalog: Catalog, piece: string): ExampleSheet | null {
  const { design } = exampleDesign(exampleOf(reference), catalog)
  const analysis = analyze(design, catalog)
  if (!analysis.valid) return null
  const purchase = estimatePurchase(design, analysis.geo, catalog)
  const numbers = lineNumbers(counterLines(design, analysis.geo, purchase))
  for (const a of purchase.layout) {
    const index = a.sheets.findIndex((s) => s.placed.some((c) => c.name === piece))
    if (index < 0) continue
    const chosen = a.sheets[index].placed.find((c) => c.name === piece)!.id
    return { a, index, total: a.sheets.length, numbers, chosen }
  }
  return null
}
