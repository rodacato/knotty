import { AXES, type Axis, type Design, type Piece } from '../design/schema'
import { roundTo, type Box, type Geometry } from '../design/resolve'
import { finishSkus, type Catalog, type FinishSku } from './catalog'
import { FINISH_PRODUCTS, FINISHES, finishOf, type FinishId, type FinishLayer, type FinishProductId } from './finishes'

// How much finish to buy: the area that gets finished, the litres the reference's formula gives and the containers that hold them.

/** Practical coverage against the data sheet's (valores-de-referencia.md §13: litres = area × coats ÷ (coverage × 0.8)). */
export const COVERAGE_EFFICIENCY = 0.8
/** The back's outer face goes against the wall (acabados.md §12). */
const ONE_FACE = new Set(['back'])

const EDGE_AXIS: Record<Piece['edges'][number], Axis> = { front: 'z', back: 'z', left: 'x', right: 'x', top: 'y', bottom: 'y' }
const size = (box: Box, axis: Axis) => box[`${axis}1`] - box[`${axis}0`]

/** The length in mm of each banded edge of a piece; an edge on its thickness axis is not an edge. */
export function bandedEdgeLengths(p: Piece, box: Box) {
  return p.edges.flatMap((edge) => {
    const axis = EDGE_AXIS[edge]
    if (axis === p.normal) return []
    return [size(box, AXES.find((e) => e !== axis && e !== p.normal)!)]
  })
}

/** m² that get finished: both faces of every piece (acabados.md §12, so it does not warp) but the back's outer one, plus the banded edges. */
export function finishArea(design: Design, geo: Geometry) {
  let mm2 = 0
  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    if (!box) continue
    const [u, v] = AXES.filter((a) => a !== p.normal)
    mm2 += size(box, u) * size(box, v) * (ONE_FACE.has(p.role) ? 1 : 2)
    mm2 += bandedEdgeLengths(p, box).reduce((s, l) => s + l * size(box, p.normal), 0)
  }
  return mm2 / 1e6
}

/** Litres of one product: area × coats ÷ (the data sheet's lowest coverage × 0.8); coverage given for the whole system counts once. */
export function finishLitres(area: number, coats: number, coverage: { min: number; per: 'coat' | 'system' }) {
  return (area * (coverage.per === 'coat' ? coats : 1)) / (coverage.min * COVERAGE_EFFICIENCY)
}

export interface ContainerCount {
  sku: FinishSku
  count: number
}

/** The containers that hold the litres: the cheapest when every size has a price, otherwise the least left over and then the fewest containers. */
export function containersFor(litres: number, skus: FinishSku[]): ContainerCount[] {
  const sizes = [...skus].sort((a, b) => b.litres - a.litres)
  if (!sizes.length || litres <= 0) return []
  const priced = sizes.every((s) => s.price !== null)
  const score = (combo: number[]) => {
    const volume = combo.reduce((s, n, i) => s + n * sizes[i].litres, 0)
    const count = combo.reduce((s, n) => s + n, 0)
    const cost = priced ? combo.reduce((s, n, i) => s + n * sizes[i].price!, 0) : 0
    return [cost, volume, count]
  }
  let best: number[] | null = null
  const search = (i: number, left: number, combo: number[]) => {
    if (i === sizes.length) {
      if (left > 1e-9) return
      const [a, b] = [score(combo), best && score(best)]
      if (!b || a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))) best = [...combo]
      return
    }
    const most = Math.ceil(left / sizes[i].litres - 1e-9)
    for (let n = 0; n <= most; n++) search(i + 1, Math.max(0, left - n * sizes[i].litres), [...combo, n])
  }
  search(0, litres, [])
  return (best ?? []).flatMap((count, i) => (count ? [{ sku: sizes[i], count }] : []))
}

export interface FinishLine {
  product: FinishProductId
  /** Coats of this product, sealer or primer included; null when the reference does not say. */
  coats: number | null
  roles: FinishLayer['role'][]
  /** Null when the reference has no coverage or no coats for it: the store has to say how much. */
  litres: number | null
  containers: ContainerCount[]
  cost: number | null
}

export interface FinishPurchase {
  finish: FinishId
  /** m² finished. */
  area: number
  lines: FinishLine[]
  /** Grits to buy; the reference gives no sheets per m², so no quantity. */
  sandpaper: number[]
}

/** What the design's finish takes; null without one. */
export function estimateFinish(design: Design, geo: Geometry, catalog: Catalog): FinishPurchase | null {
  const id = finishOf(design)
  const finish = FINISHES[id]
  if (!finish.layers.length) return null
  const area = finishArea(design, geo)
  const products = [...new Set(finish.layers.map((l) => l.product))]
  const lines = products.map((product): FinishLine => {
    const layers = finish.layers.filter((l) => l.product === product)
    const coats = layers.some((l) => l.coats === null) ? null : layers.reduce((s, l) => s + l.coats!, 0)
    const coverage = FINISH_PRODUCTS[product].coverage
    const litres = coats === null || coverage === null ? null : roundTo(finishLitres(area, coats, coverage), 2)
    const containers = litres === null ? [] : containersFor(litres, finishSkus(catalog, product))
    const unpriced = containers.some((c) => c.sku.price === null)
    return { product, coats, roles: layers.map((l) => l.role), litres, containers, cost: !containers.length || unpriced ? null : containers.reduce((s, c) => s + c.sku.price! * c.count, 0) }
  })
  const grits = finish.sanding ? [...finish.sanding.faces, ...(finish.sanding.betweenCoats ?? [])] : []
  return { finish: id, area: roundTo(area, 2), lines, sandpaper: [...new Set(grits)].sort((a, b) => a - b) }
}
