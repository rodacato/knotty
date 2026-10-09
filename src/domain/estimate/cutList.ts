import type { Design } from '../design/schema'
import { faceSize, roundTo, type Geometry } from '../design/resolve'

export interface CutLine {
  ids: string[]
  name: string
  material: string
  length: number
  width: number
  thickness: number
  count: number
}

/** The cut list: equal pieces (same material and measures) share a line. */
export function cutList(design: Design, geo: Geometry): CutLine[] {
  const lines = new Map<string, CutLine>()
  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    if (!box) continue
    const [length, width] = faceSize(box, p.normal).map((m) => roundTo(m, 0))
    const key = `${p.material}|${length}|${width}|${p.role}`
    const line = lines.get(key)
    if (line) {
      line.ids.push(p.id)
      line.count++
      line.name = sharedName(line.name, p.name)
    } else lines.set(key, { ids: [p.id], name: p.name, material: p.material, length, width, thickness: geo.thicknesses.get(p.id)!, count: 1 })
  }
  return [...lines.values()].sort((a, b) => b.thickness - a.thickness || b.length * b.width - a.length * a.width)
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

/** "Entrepaño 1" + "Entrepaño 2" → "Entrepaño"; "Contrafrente de cajón 1" + "Trasera de cajón 1" → "Contrafrente y trasera de cajón 1". */
function sharedName(a: string, b: string) {
  const [x, y] = [a.split(' '), b.split(' ')]
  let head = 0
  while (head < Math.min(x.length, y.length) && x[head] === y[head]) head++
  let tail = 0
  while (tail < Math.min(x.length, y.length) - head && x[x.length - 1 - tail] === y[y.length - 1 - tail]) tail++
  const suffix = x.slice(x.length - tail)
  if (head) return [...x.slice(0, head), ...suffix].join(' ')
  const [restA, restB] = [x.slice(0, x.length - tail).join(' '), y.slice(0, y.length - tail).join(' ')]
  if (restA.split(' y ').includes(restB.toLowerCase()) || restA === restB) return a
  return [`${restA} y ${restB.toLowerCase()}`, ...suffix].join(' ')
}
