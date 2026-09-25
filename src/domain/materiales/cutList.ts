import type { Diseno } from '../diseno/esquema'
import { faceSize, roundTo, type Geometry } from '../diseno/resolve'

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
export function cutList(design: Diseno, geo: Geometry): CutLine[] {
  const lines = new Map<string, CutLine>()
  for (const p of design.piezas) {
    const box = geo.boxes.get(p.id)
    if (!box) continue
    const [length, width] = faceSize(box, p.normal).map((m) => roundTo(m, 0))
    const key = `${p.material}|${length}|${width}|${p.rol}`
    const line = lines.get(key)
    if (line) {
      line.ids.push(p.id)
      line.count++
      line.name = sharedName(line.name, p.nombre)
    } else lines.set(key, { ids: [p.id], name: p.nombre, material: p.material, length, width, thickness: geo.thicknesses.get(p.id)!, count: 1 })
  }
  return [...lines.values()].sort((a, b) => b.thickness - a.thickness || b.length * b.width - a.length * a.width)
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
