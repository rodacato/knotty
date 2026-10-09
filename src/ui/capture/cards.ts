import { resolveGeometry, type Box } from '../../domain/design/resolve'
import { exampleDesign, type Base } from '../../domain/furniture/examples'
import type { Catalog } from '../../domain/materials/catalog'
import { sizeLine } from './catalog'

export interface Card {
  base: Base
  size: ReturnType<typeof sizeLine>
  /** What the thumbnail draws; null when the plan does not resolve. */
  boxes: Map<string, Box> | null
}

export const cardsOf = (bases: Base[], catalog: Catalog): Card[] =>
  bases.map((base) => {
    const { design } = exampleDesign(base, catalog)
    const geo = resolveGeometry(design, catalog)
    return { base, size: sizeLine(design.dimensions), boxes: geo.ok ? geo.value.boxes : null }
  })
