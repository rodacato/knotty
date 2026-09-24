import type { Diseno } from '../diseno/esquema'
import { medidasCara, type Geometria } from '../diseno/resolver'
import { hojaUtil, materialPorId, type Catalogo } from './catalogo'

// Estimación de compra, no plano de corte: cortes tipo guillotina sobre la hoja útil, probando varias heurísticas y quedándose con la de menos hojas.

export interface PiezaAcomodo {
  id: string
  nombre: string
  largo: number
  ancho: number
  /** 'fija': el largo de la pieza va sobre el largo de la hoja (veta a lo largo); 'girada': al revés; 'libre': cualquiera. */
  orientacion: 'fija' | 'girada' | 'libre'
}

export interface Colocada {
  id: string
  nombre: string
  x: number
  y: number
  /** Medidas sobre la hoja, sin holgura. */
  w: number
  h: number
  rotada: boolean
}

export interface Hoja {
  colocadas: Colocada[]
  /** Fracción de la hoja completa que se va a desperdicio (incluye refilado, cortes y sobrantes). */
  desperdicio: number
}

export interface AcomodoMaterial {
  material: string
  hoja: { largo: number; ancho: number }
  util: { largo: number; ancho: number }
  hojas: Hoja[]
  sinLugar: PiezaAcomodo[]
}

interface Libre {
  x: number
  y: number
  w: number
  h: number
}

type Ajuste = 'area' | 'lado-corto'
type Division = 'corto' | 'largo'
type Orden = 'area' | 'lado-largo' | 'perimetro'

const ORDENES: Record<Orden, (a: PiezaAcomodo, b: PiezaAcomodo) => number> = {
  area: (a, b) => b.largo * b.ancho - a.largo * a.ancho,
  'lado-largo': (a, b) => b.largo - a.largo || b.ancho - a.ancho,
  perimetro: (a, b) => b.largo + b.ancho - (a.largo + a.ancho),
}

/** Las piezas de cada material, con su orientación según la veta. */
export function piezasParaAcomodo(diseno: Diseno, geo: Geometria): Map<string, PiezaAcomodo[]> {
  const porMaterial = new Map<string, PiezaAcomodo[]>()
  for (const p of diseno.piezas) {
    const caja = geo.cajas.get(p.id)
    if (!caja) continue
    const [largo, ancho] = medidasCara(caja, p.normal)
    const orientacion = p.veta === 'libre' ? 'libre' : p.veta === 'largo' ? 'fija' : 'girada'
    porMaterial.set(p.material, [...(porMaterial.get(p.material) ?? []), { id: p.id, nombre: p.nombre, largo, ancho, orientacion }])
  }
  return porMaterial
}

function empacar(piezas: PiezaAcomodo[], util: { largo: number; ancho: number }, sierra: number, holgura: number, orden: Orden, ajuste: Ajuste, division: Division) {
  const hojas: { libres: Libre[]; colocadas: Colocada[] }[] = []
  const sinLugar: PiezaAcomodo[] = []

  const opciones = (p: PiezaAcomodo) => {
    const normal = { w: p.largo + holgura, h: p.ancho + holgura, rotada: false }
    const girada = { w: p.ancho + holgura, h: p.largo + holgura, rotada: true }
    return p.orientacion === 'fija' ? [normal] : p.orientacion === 'girada' ? [girada] : [normal, girada]
  }
  const cabe = (l: Libre, o: { w: number; h: number }) => o.w <= l.w && o.h <= l.h
  const puntaje = (l: Libre, o: { w: number; h: number }) => (ajuste === 'area' ? l.w * l.h - o.w * o.h : Math.min(l.w - o.w, l.h - o.h))

  for (const p of [...piezas].sort(ORDENES[orden])) {
    const formas = opciones(p)
    if (!formas.some((o) => cabe({ x: 0, y: 0, w: util.largo, h: util.ancho }, o))) {
      sinLugar.push(p)
      continue
    }
    let mejor: { hoja: number; libre: number; forma: (typeof formas)[number]; valor: number } | null = null
    hojas.forEach((hoja, h) =>
      hoja.libres.forEach((l, i) =>
        formas.forEach((forma) => {
          if (!cabe(l, forma)) return
          const valor = puntaje(l, forma)
          if (!mejor || valor < mejor.valor) mejor = { hoja: h, libre: i, forma, valor }
        }),
      ),
    )
    if (!mejor) {
      hojas.push({ libres: [{ x: 0, y: 0, w: util.largo, h: util.ancho }], colocadas: [] })
      const libre = hojas.at(-1)!.libres[0]
      mejor = { hoja: hojas.length - 1, libre: 0, forma: formas.find((f) => cabe(libre, f))!, valor: 0 }
    }
    const { hoja: h, libre: i, forma } = mejor as { hoja: number; libre: number; forma: (typeof formas)[number] }
    const hoja = hojas[h]
    const l = hoja.libres[i]
    hoja.colocadas.push({ id: p.id, nombre: p.nombre, x: l.x, y: l.y, w: forma.w - holgura, h: forma.h - holgura, rotada: forma.rotada })
    const restoW = l.w - forma.w - sierra
    const restoH = l.h - forma.h - sierra
    // Corte guillotina: el sobrante se parte en dos rectángulos; la división decide cuál se lleva el lado completo.
    const partirHorizontal = division === 'corto' ? restoW < restoH : restoW >= restoH
    const derecha: Libre = { x: l.x + forma.w + sierra, y: l.y, w: restoW, h: partirHorizontal ? forma.h : l.h }
    const arriba: Libre = { x: l.x, y: l.y + forma.h + sierra, w: partirHorizontal ? l.w : forma.w, h: restoH }
    hoja.libres.splice(i, 1, ...[derecha, arriba].filter((r) => r.w > 0 && r.h > 0))
  }
  return { hojas, sinLugar }
}

export function acomodar(diseno: Diseno, geo: Geometria, catalogo: Catalogo): AcomodoMaterial[] {
  const { sierra, holgura } = catalogo.acomodo
  return [...piezasParaAcomodo(diseno, geo)].flatMap(([id, piezas]) => {
    const material = materialPorId(catalogo, id)
    if (!material) return []
    const util = hojaUtil(catalogo, material)
    let mejor: ReturnType<typeof empacar> | null = null
    for (const orden of Object.keys(ORDENES) as Orden[])
      for (const ajuste of ['area', 'lado-corto'] as Ajuste[])
        for (const division of ['corto', 'largo'] as Division[]) {
          const r = empacar(piezas, util, sierra, holgura, orden, ajuste, division)
          const usadoUltima = (x: typeof r) => x.hojas.at(-1)?.colocadas.reduce((a, c) => a + c.w * c.h, 0) ?? 0
          if (!mejor || r.hojas.length < mejor.hojas.length || (r.hojas.length === mejor.hojas.length && usadoUltima(r) < usadoUltima(mejor))) mejor = r
        }
    const areaHoja = material.hoja.largo * material.hoja.ancho
    return [
      {
        material: id,
        hoja: material.hoja,
        util,
        hojas: mejor!.hojas.map((h) => ({ colocadas: h.colocadas, desperdicio: 1 - h.colocadas.reduce((a, c) => a + c.w * c.h, 0) / areaHoja })),
        sinLugar: mejor!.sinLugar,
      },
    ]
  })
}
