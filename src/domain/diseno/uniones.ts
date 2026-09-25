import { SUPUESTOS } from '../estructura/supuestos'
import type { Catalogo } from '../materiales/catalogo'
import { contactos, type Contacto } from '../validacion/contacto'
import { union } from './construir'
import type { Diseno, Pieza, Union } from './esquema'
import { resolver, type Caja } from './resolver'

// Las uniones comunes salen de la geometría, no del experto: así son iguales con cualquier modelo. El experto solo declara las especiales.

const par = (a: string, b: string) => [a, b].sort().join('|')

/** El tornillo más corto que entra lo suficiente en el canto, o el más largo que no se asoma si entra por la cara. */
function tornillo(catalogo: Catalogo, espesorA: number, espesorB: number, porLaCara: boolean) {
  const tornillos = catalogo.herrajes.filter((h) => /^tornillo-8x/.test(h.id) && h.largo).sort((x, y) => x.largo! - y.largo!)
  if (porLaCara) return [...tornillos].reverse().find((t) => t.largo! <= espesorA + espesorB - 3) ?? tornillos[0]
  return tornillos.find((t) => t.largo! - espesorA >= SUPUESTOS.tornillos.penetracionMinima) ?? tornillos.at(-1)
}

function inferir(c: Contacto, p: Pieza, q: Pieza, espesores: Map<string, number>, catalogo: Catalogo): Omit<Union, 'id'> | null {
  const trasera = p.rol === 'trasera' ? p : q.rol === 'trasera' ? q : null
  if (trasera) {
    const otra = trasera === p ? q : p
    // Una repisa que se mueve no se clava a la trasera.
    if (otra.rol === 'trasera' || otra.apoyo === 'movil') return null
    return union('', trasera.id, otra.id, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])
  }

  const movil = p.apoyo === 'movil' ? p : q.apoyo === 'movil' ? q : null
  if (movil) {
    const otra = movil === p ? q : p
    if (movil.rol !== 'entrepano' || otra.normal !== 'x' || c.eje !== 'x') return null
    return union('', movil.id, otra.id, 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }])
  }

  // El tornillo atraviesa la pieza que toca con su cara y entra por el canto de la otra; canto con canto no se atornilla.
  const deCara = [p, q].filter((x) => x.normal === c.eje)
  if (!deCara.length) return null
  const a = deCara.length === 1 ? deCara[0] : [p, q].sort((x, y) => espesores.get(x.id)! - espesores.get(y.id)! || x.id.localeCompare(y.id))[0]
  const b = a === p ? q : p
  const ta = espesores.get(a.id)!
  if (ta <= SUPUESTOS.espesorDeClavar) return union('', a.id, b.id, 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])
  const t = tornillo(catalogo, ta, espesores.get(b.id)!, deCara.length === 2)
  return union('', a.id, b.id, 'tope-tornillo', t ? [{ herrajeId: t.id, cantidad: null }] : [])
}

/** La puerta cuelga del vertical más cercano a una de sus orillas. */
function bisagra(puerta: Pieza, caja: Caja, vecinos: { pieza: Pieza; caja: Caja }[]): Omit<Union, 'id'> | null {
  const verticales = vecinos.filter((x) => x.pieza.normal === 'x' && x.pieza.rol !== 'puerta')
  if (!verticales.length) return null
  const centro = (k: Caja) => (k.x0 + k.x1) / 2
  const distancia = (k: Caja) => Math.min(Math.abs(centro(k) - caja.x0), Math.abs(centro(k) - caja.x1))
  // En empate, a la izquierda: es lo que espera quien abre.
  const elegido = [...verticales].sort((m, n) => distancia(m.caja) - distancia(n.caja) || centro(m.caja) - centro(n.caja))[0]
  return union('', puerta.id, elegido.pieza.id, 'bisagra-cazoleta', [{ herrajeId: 'bisagra-cazoleta-35-recta', cantidad: null }])
}

/** Agrega las uniones que falten; con `previo`, solo donde el cambio creó un contacto, para no revivir una unión quitada a propósito. */
export function completarUniones(diseno: Diseno, catalogo: Catalogo, previo?: Diseno): Diseno {
  const r = resolver(diseno, catalogo)
  if (!r.ok) return diseno
  const { cajas, espesores } = r.valor
  const porId = new Map(diseno.piezas.map((p) => [p.id, p]))
  const unidos = new Set(diseno.uniones.map((u) => par(u.a, u.b)))
  const ids = new Set(diseno.uniones.map((u) => u.id))
  const rp = previo && resolver(previo, catalogo)
  const anteriores = new Set(rp && rp.ok ? contactos(rp.valor.cajas).map((c) => par(c.a, c.b)) : [])

  const nuevas: Union[] = []
  const agregar = (u: Omit<Union, 'id'> | null) => {
    if (!u) return
    let id = `u-${u.a}-${u.b}`
    for (let n = 2; ids.has(id); n++) id = `u-${u.a}-${u.b}-${n}`
    ids.add(id)
    unidos.add(par(u.a, u.b))
    nuevas.push({ ...u, id })
  }

  const tocando = contactos(cajas).filter((c) => c.eje !== null && !unidos.has(par(c.a, c.b)) && !anteriores.has(par(c.a, c.b)))
  for (const c of tocando) {
    const p = porId.get(c.a)!
    const q = porId.get(c.b)!
    // Las puertas van aparte y las piezas de un cajón ya traen sus uniones.
    if (p.rol === 'puerta' || q.rol === 'puerta' || p.grupo || q.grupo) continue
    agregar(inferir(c, p, q, espesores, catalogo))
  }

  for (const puerta of diseno.piezas.filter((p) => p.rol === 'puerta')) {
    if ([...unidos].some((k) => k.split('|').includes(puerta.id))) continue
    const vecinos = tocando.filter((c) => c.a === puerta.id || c.b === puerta.id).map((c) => porId.get(c.a === puerta.id ? c.b : c.a)!)
    agregar(bisagra(puerta, cajas.get(puerta.id)!, vecinos.map((pieza) => ({ pieza, caja: cajas.get(pieza.id)! }))))
  }

  return nuevas.length ? { ...diseno, uniones: [...diseno.uniones, ...nuevas] } : diseno
}
