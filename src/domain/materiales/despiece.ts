import type { Diseno } from '../diseno/esquema'
import { medidasCara, redondear, type Geometria } from '../diseno/resolver'

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
export function despiece(diseno: Diseno, geo: Geometria): RenglonDespiece[] {
  const renglones = new Map<string, RenglonDespiece>()
  for (const p of diseno.piezas) {
    const caja = geo.cajas.get(p.id)
    if (!caja) continue
    const [largo, ancho] = medidasCara(caja, p.normal).map((m) => redondear(m, 0))
    const clave = `${p.material}|${largo}|${ancho}|${p.rol}`
    const existente = renglones.get(clave)
    if (existente) {
      existente.ids.push(p.id)
      existente.cantidad++
      existente.nombre = nombreComun(existente.nombre, p.nombre)
    } else renglones.set(clave, { ids: [p.id], nombre: p.nombre, material: p.material, largo, ancho, espesor: geo.espesores.get(p.id)!, cantidad: 1 })
  }
  return [...renglones.values()].sort((a, b) => b.espesor - a.espesor || b.largo * b.ancho - a.largo * a.ancho)
}

/** "Entrepaño 1" + "Entrepaño 2" → "Entrepaño". */
function nombreComun(a: string, b: string) {
  const palabras = a.split(' ')
  const otras = b.split(' ')
  const comunes = palabras.filter((w, i) => otras[i] === w)
  return comunes.length ? comunes.join(' ') : a
}
