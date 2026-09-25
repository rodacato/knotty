import { EJES, type Diseno, type Eje, type Union } from '../diseno/esquema'
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
const EDGE_AXIS: Record<string, Eje> = { frente: 'z', atras: 'z', izq: 'x', der: 'x', arriba: 'y', abajo: 'y' }

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
export function hardwarePerJoint(u: Union, geo: Geometry): number {
  const a = geo.boxes.get(u.a)
  const b = geo.boxes.get(u.b)
  const length = a && b ? jointLength(a, b) : 0
  const bySpacing = (spacing: number, minimum: number) => Math.max(minimum, Math.ceil((length - 2 * END_MARGIN) / spacing) + 1)
  switch (u.tipo) {
    case 'tope-tornillo':
    case 'bolsillo':
      return bySpacing(SPACING.screw, 2)
    case 'tarugo':
    case 'minifix':
      return bySpacing(SPACING.dowel, 2)
    case 'clavo-pegamento':
      return bySpacing(SPACING.nail, 2)
    case 'soporte-repisa':
      return 2
    case 'bisagra-cazoleta': {
      const door = geo.boxes.get(u.a)
      return hingesFor(door ? door.y1 - door.y0 : 0)
    }
    case 'escuadra':
      return 2
    case 'corredera':
    case 'canal':
    case 'rebaje':
      return 1
  }
}

/** Metres of edge banding: the marked edges of every piece added up. */
export function edgeBandingMeters(design: Diseno, geo: Geometry) {
  let mm = 0
  for (const p of design.piezas) {
    const box = geo.boxes.get(p.id)
    if (!box) continue
    for (const edge of p.cantos) {
      const axis = EDGE_AXIS[edge]
      if (axis === p.normal) continue
      const along = EJES.find((e) => e !== axis && e !== p.normal)!
      mm += box[`${along}1`] - box[`${along}0`]
    }
  }
  return roundTo((mm / 1000) * EDGE_BANDING_WASTE, 1)
}

export function estimatePurchase(design: Diseno, geo: Geometry, catalog: Catalog): Purchase {
  const missingPrices: string[] = []
  const layout = layOut(design, geo, catalog)
  const thicknessOf = (id: string) => catalog.materiales.find((m) => m.id === id)?.espesor ?? 0

  const sheets: SheetLine[] = [...layout].sort((a, b) => thicknessOf(b.material) - thicknessOf(a.material)).map((a) => {
    const material = catalog.materiales.find((m) => m.id === a.material)!
    const n = a.sheets.length + a.unplaced.length
    if (material.precio === null) missingPrices.push(material.nombre)
    return {
      material,
      sheets: n,
      waste: a.sheets.length ? a.sheets.reduce((s, h) => s + h.waste, 0) / a.sheets.length : 0,
      cost: material.precio === null ? null : material.precio * n,
    }
  })

  const counts = new Map<string, number>()
  const add = (id: string, n: number) => counts.set(id, (counts.get(id) ?? 0) + n)
  for (const u of design.uniones) for (const h of u.herrajes) add(h.herrajeId, h.cantidad ?? hardwarePerJoint(u, geo))
  const glued = design.uniones.filter((u) => u.pegamento).length
  if (glued) add('pegamento-blanco', Math.ceil(glued / JOINTS_PER_GLUE_BOTTLE))
  const edgeBanding = edgeBandingMeters(design, geo)

  const hardware: HardwareLine[] = [...counts].flatMap(([id, count]) => {
    const item = catalog.herrajes.find((h) => h.id === id)
    if (!item) return []
    const packs = item.porPaquete ? Math.ceil(count / item.porPaquete) : null
    if (item.precio === null) missingPrices.push(item.nombre)
    return [{ hardware: item, count, packs, cost: item.precio === null ? null : item.precio * (packs ?? count) }]
  })
  const tape = catalog.herrajes.find((h) => h.unidad === 'metro')
  if (edgeBanding > 0 && tape) {
    if (tape.precio === null) missingPrices.push(tape.nombre)
    hardware.push({ hardware: tape, count: Math.ceil(edgeBanding), packs: null, cost: tape.precio === null ? null : tape.precio * Math.ceil(edgeBanding) })
  }

  const total = [...sheets, ...hardware].reduce((s, r) => s + (r.cost ?? 0), 0)
  return { layout, sheets, hardware, edgeBanding, cost: { total: roundTo(total, 0), missingPrices } }
}
