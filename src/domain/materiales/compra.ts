import { EJES, type Diseno, type Eje, type Union } from '../diseno/esquema'
import { redondear, type Geometria } from '../diseno/resolver'
import { largoDeJunta } from '../validacion/contacto'
import { bisagrasPara } from '../estructura/supuestos'
import { acomodar, type AcomodoMaterial } from './acomodo'
import type { Catalogo, Herraje, MaterialTablero } from './catalogo'

// La lista de compra: hojas por espesor, herrajes, cubrecanto y pegamento, con costo aproximado.

const SEPARACION = { tornillo: 200, clavo: 150, tarugo: 150 }
const MARGEN_EXTREMO = 50
const MERMA_CUBRECANTO = 1.1
const UNIONES_POR_FRASCO = 20
const CANTO_EJE: Record<string, Eje> = { frente: 'z', atras: 'z', izq: 'x', der: 'x', arriba: 'y', abajo: 'y' }

export interface RenglonHojas {
  material: MaterialTablero
  hojas: number
  desperdicio: number
  costo: number | null
}

export interface RenglonHerraje {
  herraje: Herraje
  cantidad: number
  /** Cuántos empaques comprar si se vende por paquete. */
  paquetes: number | null
  costo: number | null
}

export interface Compra {
  acomodo: AcomodoMaterial[]
  hojas: RenglonHojas[]
  herrajes: RenglonHerraje[]
  /** Metros de cubrecanto, con merma. */
  cubrecanto: number
  costo: { total: number; faltanPrecios: string[] }
}

/** Cuántos herrajes lleva una unión cuando el modelo no lo dice: por separación a lo largo de la junta. */
export function cantidadPorUnion(u: Union, geo: Geometria): number {
  const a = geo.cajas.get(u.a)
  const b = geo.cajas.get(u.b)
  const largo = a && b ? largoDeJunta(a, b) : 0
  const porSeparacion = (sep: number, minimo: number) => Math.max(minimo, Math.ceil((largo - 2 * MARGEN_EXTREMO) / sep) + 1)
  switch (u.tipo) {
    case 'tope-tornillo':
    case 'bolsillo':
      return porSeparacion(SEPARACION.tornillo, 2)
    case 'tarugo':
    case 'minifix':
      return porSeparacion(SEPARACION.tarugo, 2)
    case 'clavo-pegamento':
      return porSeparacion(SEPARACION.clavo, 2)
    case 'soporte-repisa':
      return 2
    case 'bisagra-cazoleta': {
      const puerta = geo.cajas.get(u.a)
      const alto = puerta ? puerta.y1 - puerta.y0 : 0
      return bisagrasPara(alto)
    }
    case 'escuadra':
      return 2
    case 'corredera':
    case 'canal':
    case 'rebaje':
      return 1
  }
}

/** Metros de cubrecanto: la suma de los cantos marcados de cada pieza. */
export function metrosDeCubrecanto(diseno: Diseno, geo: Geometria) {
  let mm = 0
  for (const p of diseno.piezas) {
    const caja = geo.cajas.get(p.id)
    if (!caja) continue
    for (const canto of p.cantos) {
      const eje = CANTO_EJE[canto]
      if (eje === p.normal) continue
      const largoDelCanto = EJES.find((e) => e !== eje && e !== p.normal)!
      mm += caja[`${largoDelCanto}1`] - caja[`${largoDelCanto}0`]
    }
  }
  return redondear((mm / 1000) * MERMA_CUBRECANTO, 1)
}

export function estimarCompra(diseno: Diseno, geo: Geometria, catalogo: Catalogo): Compra {
  const faltanPrecios: string[] = []
  const acomodo = acomodar(diseno, geo, catalogo)
  const espesorDe = (id: string) => catalogo.materiales.find((m) => m.id === id)?.espesor ?? 0

  const hojas: RenglonHojas[] = [...acomodo].sort((a, b) => espesorDe(b.material) - espesorDe(a.material)).map((a) => {
    const material = catalogo.materiales.find((m) => m.id === a.material)!
    const n = a.hojas.length + a.sinLugar.length
    if (material.precio === null) faltanPrecios.push(material.nombre)
    return {
      material,
      hojas: n,
      desperdicio: a.hojas.length ? a.hojas.reduce((s, h) => s + h.desperdicio, 0) / a.hojas.length : 0,
      costo: material.precio === null ? null : material.precio * n,
    }
  })

  const cantidades = new Map<string, number>()
  const sumar = (id: string, n: number) => cantidades.set(id, (cantidades.get(id) ?? 0) + n)
  for (const u of diseno.uniones) for (const h of u.herrajes) sumar(h.herrajeId, h.cantidad ?? cantidadPorUnion(u, geo))
  const conPegamento = diseno.uniones.filter((u) => u.pegamento).length
  if (conPegamento) sumar('pegamento-blanco', Math.ceil(conPegamento / UNIONES_POR_FRASCO))
  const cubrecanto = metrosDeCubrecanto(diseno, geo)

  const herrajes: RenglonHerraje[] = [...cantidades].flatMap(([id, cantidad]) => {
    const herraje = catalogo.herrajes.find((h) => h.id === id)
    if (!herraje) return []
    const paquetes = herraje.porPaquete ? Math.ceil(cantidad / herraje.porPaquete) : null
    if (herraje.precio === null) faltanPrecios.push(herraje.nombre)
    return [{ herraje, cantidad, paquetes, costo: herraje.precio === null ? null : herraje.precio * (paquetes ?? cantidad) }]
  })
  const cinta = catalogo.herrajes.find((h) => h.unidad === 'metro')
  if (cubrecanto > 0 && cinta) {
    if (cinta.precio === null) faltanPrecios.push(cinta.nombre)
    herrajes.push({ herraje: cinta, cantidad: Math.ceil(cubrecanto), paquetes: null, costo: cinta.precio === null ? null : cinta.precio * Math.ceil(cubrecanto) })
  }

  const total = [...hojas, ...herrajes].reduce((s, r) => s + (r.costo ?? 0), 0)
  return { acomodo, hojas, herrajes, cubrecanto, costo: { total: redondear(total, 0), faltanPrecios } }
}
