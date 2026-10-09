import type { Design } from '../design/schema'
import { faceSize, roundTo, type Geometry } from '../design/resolve'
import { namesText } from './pieceNames'

export interface CutLine {
  ids: string[]
  /** Every piece of the line, a run of numbers said once. */
  name: string
  material: string
  length: number
  width: number
  thickness: number
  count: number
}

/** The cut list: equal pieces (same material and measures) share a line. */
export function cutList(design: Design, geo: Geometry): CutLine[] {
  const groups = new Map<string, Omit<CutLine, 'name' | 'count'> & { names: string[] }>()
  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    if (!box) continue
    const [length, width] = faceSize(box, p.normal).map((m) => roundTo(m, 0))
    const key = `${p.material}|${length}|${width}|${p.role}`
    const group = groups.get(key)
    if (group) {
      group.ids.push(p.id)
      group.names.push(p.name)
    } else groups.set(key, { ids: [p.id], names: [p.name], material: p.material, length, width, thickness: geo.thicknesses.get(p.id)! })
  }
  return [...groups.values()]
    .map(({ names, ...line }) => ({ ...line, name: namesText(names), count: line.ids.length }))
    .sort((a, b) => b.thickness - a.thickness || b.length * b.width - a.length * a.width)
}

/** How many boards of a line still get work the rectangle does not say: a corner sawn off on a slant, a corner rounded, a hole drilled, or wood taken out (a notch, grooves, fingers). */
export interface AfterCut {
  diagonal: number
  curved: number
  drilled: number
  routed: number
}

export function afterCut(design: Design, line: Pick<CutLine, 'ids'>): AfterCut {
  const pieces = design.pieces.filter((p) => line.ids.includes(p.id))
  return { diagonal: pieces.filter((p) => p.slants?.length).length, curved: pieces.filter((p) => p.rounds?.length).length, drilled: pieces.filter((p) => p.holes?.length).length, routed: pieces.filter((p) => p.cuts?.length).length }
}

/** For the person, under the measures of a line; null when its boards are done once cut to size. */
export function afterCutText({ diagonal, curved, drilled, routed }: AfterCut, count: number): string | null {
  const part = (n: number, what: string) => (n === 0 ? [] : [n === count ? what : `${n} de ${count} con ${what}`])
  const parts = [...part(diagonal, 'corte diagonal'), ...part(curved, 'esquinas redondeadas'), ...part(drilled, 'barreno'), ...part(routed, 'saques o ranuras')]
  return parts.length ? `Después de ${count === 1 ? 'cortarla' : 'cortarlas'}: ${parts.join(' · ')}` : null
}
