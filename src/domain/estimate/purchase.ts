import type { Design } from '../design/schema'
import { roundTo, type Geometry } from '../design/resolve'
import { hardwarePerJoint } from '../design/hardwareCount'
import { layOut, type MaterialLayout } from './layout'
import { pickHardware, type Catalog, type Hardware, type BoardMaterial } from '../materials/catalog'
import { bandedEdgeLengths, estimateFinish, type FinishPurchase } from './finishPurchase'

// The shopping list: sheets by thickness, hardware, edge banding, glue and the finish, with an approximate cost.

const EDGE_BANDING_WASTE = 1.1
const JOINTS_PER_GLUE_BOTTLE = 20

interface SheetLine {
  material: BoardMaterial
  sheets: number
  waste: number
  cost: number | null
}

interface HardwareLine {
  hardware: Hardware
  count: number
  /** How many packs to buy when it comes in packs. */
  packs: number | null
  cost: number | null
}

export interface Purchase {
  layout: MaterialLayout[]
  sheets: SheetLine[]
  hardware: HardwareLine[]
  /** Metres of edge banding, waste included. */
  edgeBanding: number
  /** Null when the design has no finish. */
  finish: FinishPurchase | null
  cost: { total: number; missingPrices: string[] }
}

/** Metres of edge banding: the marked edges of every piece added up. */
export function edgeBandingMeters(design: Design, geo: Geometry) {
  let mm = 0
  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    if (box) mm += bandedEdgeLengths(p, box).reduce((s, l) => s + l, 0)
  }
  return roundTo((mm / 1000) * EDGE_BANDING_WASTE, 1)
}

export function estimatePurchase(design: Design, geo: Geometry, catalog: Catalog): Purchase {
  const missingPrices: string[] = []
  const layout = layOut(design, geo, catalog)
  const thicknessOf = (id: string) => catalog.materials.find((m) => m.id === id)?.thickness ?? 0

  const sheets: SheetLine[] = [...layout].sort((a, b) => thicknessOf(b.material) - thicknessOf(a.material)).map((a) => {
    const material = catalog.materials.find((m) => m.id === a.material)!
    const n = a.sheets.length + a.unplaced.length
    if (material.price === null) missingPrices.push(material.name)
    return {
      material,
      sheets: n,
      waste: a.sheets.length ? a.sheets.reduce((s, h) => s + h.waste, 0) / a.sheets.length : 0,
      cost: material.price === null ? null : material.price * n,
    }
  })

  const counts = new Map<string, number>()
  const add = (id: string, n: number) => counts.set(id, (counts.get(id) ?? 0) + n)
  for (const u of design.joints) for (const h of u.hardware) add(h.hardwareId, h.count ?? hardwarePerJoint(u, geo))
  // A handle joins nothing, so it is counted from the fronts it opens.
  const handle = pickHardware(catalog, 'handle')
  const handles = design.pieces.filter((p) => (p.role === 'door' || p.role === 'drawer-front') && (design.pullsOf?.[p.id] ?? design.pulls) === 'handle').length
  if (handle && handles) add(handle.id, handles)
  // Anchored is what keeps it from tipping, so the kit that anchors it is bought; a wall cabinet hangs from its rail instead.
  const antiTip = pickHardware(catalog, 'anti-tip')
  if (antiTip && design.wallAnchored && design.kind !== 'wallCabinet') add(antiTip.id, 1)
  const glued = design.joints.filter((u) => u.glue).length
  const glue = pickHardware(catalog, 'glue')
  if (glued && glue) add(glue.id, Math.ceil(glued / JOINTS_PER_GLUE_BOTTLE))
  const edgeBanding = edgeBandingMeters(design, geo)

  const hardware: HardwareLine[] = [...counts].flatMap(([id, count]) => {
    const item = catalog.hardware.find((h) => h.id === id)
    if (!item) return []
    const packs = item.perPack ? Math.ceil(count / item.perPack) : null
    if (item.price === null) missingPrices.push(item.name)
    return [{ hardware: item, count, packs, cost: item.price === null ? null : item.price * (packs ?? count) }]
  })
  // The catalog has one edge banding, 19 mm wide, for every board; another item sold by the metre is not it.
  const tape = pickHardware(catalog, 'edge-banding')
  if (edgeBanding > 0 && tape) {
    if (tape.price === null) missingPrices.push(tape.name)
    hardware.push({ hardware: tape, count: Math.ceil(edgeBanding), packs: null, cost: tape.price === null ? null : tape.price * Math.ceil(edgeBanding) })
  }

  const finish = estimateFinish(design, geo, catalog)
  const containers = finish?.lines.flatMap((l) => l.containers) ?? []
  for (const c of containers) if (c.sku.price === null) missingPrices.push(c.sku.name)

  const total = [...sheets, ...hardware].reduce((s, r) => s + (r.cost ?? 0), 0) + containers.reduce((s, c) => s + (c.sku.price ?? 0) * c.count, 0)
  return { layout, sheets, hardware, edgeBanding, finish, cost: { total: roundTo(total, 0), missingPrices } }
}
