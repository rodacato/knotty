import type { Design } from '../diseno/schema'
import { faceSize, type Geometry } from '../diseno/resolve'
import { usableSheet, materialById, type Catalog } from './catalog'

// A purchase estimate, not a cutting plan: guillotine cuts on the usable sheet, trying several heuristics and keeping the one with fewest sheets.

export interface LayoutPiece {
  id: string
  name: string
  length: number
  width: number
  /** 'fixed': the piece's length runs along the sheet's (grain along); 'turned': the other way; 'free': either. */
  orientation: 'fixed' | 'turned' | 'free'
}

export interface Placed {
  id: string
  name: string
  x: number
  y: number
  /** Its size on the sheet, without play. */
  w: number
  h: number
  rotated: boolean
}

export interface Sheet {
  placed: Placed[]
  /** The fraction of the whole sheet that goes to waste (trimming, cuts and offcuts included). */
  waste: number
}

export interface MaterialLayout {
  material: string
  sheet: { largo: number; ancho: number }
  usable: { largo: number; ancho: number }
  sheets: Sheet[]
  unplaced: LayoutPiece[]
}

interface Free {
  x: number
  y: number
  w: number
  h: number
}

type Fit = 'area' | 'short-side'
type Split = 'short' | 'long'
type Order = 'area' | 'long-side' | 'perimeter'

const ORDERS: Record<Order, (a: LayoutPiece, b: LayoutPiece) => number> = {
  area: (a, b) => b.length * b.width - a.length * a.width,
  'long-side': (a, b) => b.length - a.length || b.width - a.width,
  perimeter: (a, b) => b.length + b.width - (a.length + a.width),
}

/** Each material's pieces, turned as their grain allows. */
export function layoutPieces(design: Design, geo: Geometry): Map<string, LayoutPiece[]> {
  const byMaterial = new Map<string, LayoutPiece[]>()
  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    if (!box) continue
    const [length, width] = faceSize(box, p.normal)
    const orientation = p.grain === 'any' ? 'free' : p.grain === 'length' ? 'fixed' : 'turned'
    byMaterial.set(p.material, [...(byMaterial.get(p.material) ?? []), { id: p.id, name: p.name, length, width, orientation }])
  }
  return byMaterial
}

function pack(pieces: LayoutPiece[], usable: { largo: number; ancho: number }, kerf: number, play: number, order: Order, fit: Fit, split: Split) {
  const sheets: { free: Free[]; placed: Placed[] }[] = []
  const unplaced: LayoutPiece[] = []

  const options = (p: LayoutPiece) => {
    const straight = { w: p.length + play, h: p.width + play, rotated: false }
    const turned = { w: p.width + play, h: p.length + play, rotated: true }
    return p.orientation === 'fixed' ? [straight] : p.orientation === 'turned' ? [turned] : [straight, turned]
  }
  const fits = (l: Free, o: { w: number; h: number }) => o.w <= l.w && o.h <= l.h
  const score = (l: Free, o: { w: number; h: number }) => (fit === 'area' ? l.w * l.h - o.w * o.h : Math.min(l.w - o.w, l.h - o.h))

  for (const p of [...pieces].sort(ORDERS[order])) {
    const shapes = options(p)
    if (!shapes.some((o) => fits({ x: 0, y: 0, w: usable.largo, h: usable.ancho }, o))) {
      unplaced.push(p)
      continue
    }
    let best: { sheet: number; free: number; shape: (typeof shapes)[number]; value: number } | null = null
    sheets.forEach((sheet, s) =>
      sheet.free.forEach((l, i) =>
        shapes.forEach((shape) => {
          if (!fits(l, shape)) return
          const value = score(l, shape)
          if (!best || value < best.value) best = { sheet: s, free: i, shape, value }
        }),
      ),
    )
    if (!best) {
      sheets.push({ free: [{ x: 0, y: 0, w: usable.largo, h: usable.ancho }], placed: [] })
      const free = sheets.at(-1)!.free[0]
      best = { sheet: sheets.length - 1, free: 0, shape: shapes.find((f) => fits(free, f))!, value: 0 }
    }
    const { sheet: s, free: i, shape } = best as { sheet: number; free: number; shape: (typeof shapes)[number] }
    const sheet = sheets[s]
    const l = sheet.free[i]
    sheet.placed.push({ id: p.id, name: p.name, x: l.x, y: l.y, w: shape.w - play, h: shape.h - play, rotated: shape.rotated })
    const restW = l.w - shape.w - kerf
    const restH = l.h - shape.h - kerf
    // Guillotine cut: what is left splits into two rectangles; the split decides which one takes the full side.
    const horizontal = split === 'short' ? restW < restH : restW >= restH
    const right: Free = { x: l.x + shape.w + kerf, y: l.y, w: restW, h: horizontal ? shape.h : l.h }
    const above: Free = { x: l.x, y: l.y + shape.h + kerf, w: horizontal ? l.w : shape.w, h: restH }
    sheet.free.splice(i, 1, ...[right, above].filter((r) => r.w > 0 && r.h > 0))
  }
  return { sheets, unplaced }
}

export function layOut(design: Design, geo: Geometry, catalog: Catalog): MaterialLayout[] {
  const { sierra: kerf, holgura: play } = catalog.acomodo
  return [...layoutPieces(design, geo)].flatMap(([id, pieces]) => {
    const material = materialById(catalog, id)
    if (!material) return []
    const usable = usableSheet(catalog, material)
    let best: ReturnType<typeof pack> | null = null
    for (const order of Object.keys(ORDERS) as Order[])
      for (const fit of ['area', 'short-side'] as Fit[])
        for (const split of ['short', 'long'] as Split[]) {
          const r = pack(pieces, usable, kerf, play, order, fit, split)
          const usedInLast = (x: typeof r) => x.sheets.at(-1)?.placed.reduce((a, c) => a + c.w * c.h, 0) ?? 0
          if (!best || r.sheets.length < best.sheets.length || (r.sheets.length === best.sheets.length && usedInLast(r) < usedInLast(best))) best = r
        }
    const sheetArea = material.hoja.largo * material.hoja.ancho
    return [
      {
        material: id,
        sheet: material.hoja,
        usable,
        sheets: best!.sheets.map((h) => ({ placed: h.placed, waste: 1 - h.placed.reduce((a, c) => a + c.w * c.h, 0) / sheetArea })),
        unplaced: best!.unplaced,
      },
    ]
  })
}
