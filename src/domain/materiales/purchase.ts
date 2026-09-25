import { AXES, type Design, type Axis, type Joint } from '../diseno/schema'
import { roundTo, type Geometry } from '../diseno/resolve'
import { jointLength } from '../validation/contact'
import { hingesFor } from '../structure/assumptions'
import { layOut, type MaterialLayout } from './layout'
import type { Catalog, Hardware, BoardMaterial } from './catalog'

// The shopping list: sheets by thickness, hardware, edge banding and glue, with an approximate cost.

const SPACING = { screw: 200, nail: 150, dowel: 150 }
const END_MARGIN = 50
const EDGE_BANDING_WASTE = 1.1
const JOINTS_PER_GLUE_BOTTLE = 20
const EDGE_AXIS: Record<string, Axis> = { front: 'z', back: 'z', left: 'x', right: 'x', top: 'y', bottom: 'y' }

export interface SheetLine {
  material: BoardMaterial
  sheets: number
  waste: number
  cost: number | null
}

export interface HardwareLine {
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
  cost: { total: number; missingPrices: string[] }
}

/** How much hardware a joint takes when the model does not say: by spacing along the joint. */
export function hardwarePerJoint(u: Joint, geo: Geometry): number {
  const a = geo.boxes.get(u.a)
  const b = geo.boxes.get(u.b)
  const length = a && b ? jointLength(a, b) : 0
  const bySpacing = (spacing: number, minimum: number) => Math.max(minimum, Math.ceil((length - 2 * END_MARGIN) / spacing) + 1)
  switch (u.type) {
    case 'butt-screw':
    case 'pocket-screw':
      return bySpacing(SPACING.screw, 2)
    case 'dowel':
    case 'cam-lock':
      return bySpacing(SPACING.dowel, 2)
    case 'glue-nail':
      return bySpacing(SPACING.nail, 2)
    case 'shelf-pin':
      return 2
    case 'cup-hinge': {
      const door = geo.boxes.get(u.a)
      return hingesFor(door ? door.y1 - door.y0 : 0)
    }
    case 'bracket':
      return 2
    case 'drawer-slide':
    case 'dado':
    case 'rabbet':
      return 1
  }
}

/** Metres of edge banding: the marked edges of every piece added up. */
export function edgeBandingMeters(design: Design, geo: Geometry) {
  let mm = 0
  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    if (!box) continue
    for (const edge of p.edges) {
      const axis = EDGE_AXIS[edge]
      if (axis === p.normal) continue
      const along = AXES.find((e) => e !== axis && e !== p.normal)!
      mm += box[`${along}1`] - box[`${along}0`]
    }
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
  const glued = design.joints.filter((u) => u.glue).length
  if (glued) add('white-glue', Math.ceil(glued / JOINTS_PER_GLUE_BOTTLE))
  const edgeBanding = edgeBandingMeters(design, geo)

  const hardware: HardwareLine[] = [...counts].flatMap(([id, count]) => {
    const item = catalog.hardware.find((h) => h.id === id)
    if (!item) return []
    const packs = item.perPack ? Math.ceil(count / item.perPack) : null
    if (item.price === null) missingPrices.push(item.name)
    return [{ hardware: item, count, packs, cost: item.price === null ? null : item.price * (packs ?? count) }]
  })
  const tape = catalog.hardware.find((h) => h.unit === 'meter')
  if (edgeBanding > 0 && tape) {
    if (tape.price === null) missingPrices.push(tape.name)
    hardware.push({ hardware: tape, count: Math.ceil(edgeBanding), packs: null, cost: tape.price === null ? null : tape.price * Math.ceil(edgeBanding) })
  }

  const total = [...sheets, ...hardware].reduce((s, r) => s + (r.cost ?? 0), 0)
  return { layout, sheets, hardware, edgeBanding, cost: { total: roundTo(total, 0), missingPrices } }
}
