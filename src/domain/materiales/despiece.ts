import type { Diseno } from '../diseno/esquema'
import { faceSize, roundTo, type Geometry } from '../diseno/resolve'

export interface RenglonDespiece {
  ids: string[]
  nombre: string
  material: string
  largo: number
  ancho: number
  espesor: number
  cantidad: number
}

/** Lista de corte: piezas iguales (material y medidas) se agrupan. */
export function despiece(diseno: Diseno, geo: Geometry): RenglonDespiece[] {
  const renglones = new Map<string, RenglonDespiece>()
  for (const p of diseno.piezas) {
    const caja = geo.boxes.get(p.id)
    if (!caja) continue
    const [largo, ancho] = faceSize(caja, p.normal).map((m) => roundTo(m, 0))
    const clave = `${p.material}|${largo}|${ancho}|${p.rol}`
    const existente = renglones.get(clave)
    if (existente) {
      existente.ids.push(p.id)
      existente.cantidad++
      existente.nombre = nombreComun(existente.nombre, p.nombre)
    } else renglones.set(clave, { ids: [p.id], nombre: p.nombre, material: p.material, largo, ancho, espesor: geo.thicknesses.get(p.id)!, cantidad: 1 })
  }
  return [...renglones.values()].sort((a, b) => b.espesor - a.espesor || b.largo * b.ancho - a.largo * a.ancho)
}

/** "Entrepaño 1" + "Entrepaño 2" → "Entrepaño"; "Contrafrente de cajón 1" + "Trasera de cajón 1" → "Contrafrente y trasera de cajón 1". */
function nombreComun(a: string, b: string) {
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
