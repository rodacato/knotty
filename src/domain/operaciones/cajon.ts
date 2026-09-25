import { desde, hasta, pieza, ref, tramo, union } from '../diseno/construir'
import type { CaraRef, Pieza, Union } from '../diseno/esquema'
import { parseCara, type Geometria } from '../diseno/resolver'
import { materialPorId, type Catalogo, type Herraje } from '../materiales/catalogo'
import { error, type ErrorDiseno } from '../validacion/errores'

// Un cajón DIY con frente embutido y correderas telescópicas: caja de cuatro lados atornillada, fondo clavado abajo y frente al ras.

export const HOLGURA_FRENTE = 2
const HOLGURA_ABAJO = 12
const HOLGURA_ARRIBA = 20
const FONDO_LIBRE = 10

export interface PedidoCajon {
  grupo: string
  nombre: string
  izquierda: CaraRef
  derecha: CaraRef
  abajo: CaraRef
  arriba: CaraRef
  frente: CaraRef
  fondo: CaraRef
  material: string
  materialFondo: string
}

export const correderas = (catalogo: Catalogo) =>
  catalogo.herrajes.filter((h): h is Herraje & { largo: number; holguraLateral: number } => h.id.startsWith('corredera') && h.largo !== null && h.holguraLateral !== null)

/** La corredera más larga que cabe en el fondo disponible. */
export function correderaPara(profundidad: number, catalogo: Catalogo) {
  return correderas(catalogo)
    .filter((c) => c.largo <= profundidad - FONDO_LIBRE)
    .sort((a, b) => b.largo - a.largo)[0]
}

/** Las piezas y uniones del cajón, todas referidas a las caras del hueco para que se ajusten si el mueble cambia. */
export function expandirCajon(c: PedidoCajon, geo: Geometria, catalogo: Catalogo): { piezas: Pieza[]; uniones: Union[] } | ErrorDiseno {
  for (const m of [c.material, c.materialFondo]) if (!materialPorId(catalogo, m)) return error('E_ESPESOR_CATALOGO', `El material "${m}" no está en el catálogo.`, { material: m })
  const espesorFrente = materialPorId(catalogo, c.material)!.espesor
  const zFrente = geo.valor({ tipo: 'ref', ref: c.frente, mas: 0 }, 'z')
  const zFondo = geo.valor({ tipo: 'ref', ref: c.fondo, mas: 0 }, 'z')
  // A drawer opens toward its front: forward as usual, or backward when the front is behind the bottom of the opening (the far side of a bed).
  const atras = zFrente < zFondo
  const profundidad = Math.abs(zFrente - zFondo) - espesorFrente
  const corredera = correderaPara(profundidad, catalogo)
  if (!corredera) {
    const minima = Math.min(...correderas(catalogo).map((c) => c.largo))
    const faltan = Math.ceil(minima + FONDO_LIBRE - profundidad)
    return error('E_OPERACION_INVALIDA', `No cabe un cajón: quedan ${Math.round(profundidad)} mm de fondo y la corredera más corta, de ${minima / 10} cm, pide ${faltan} mm más. Hazlo más profundo o usa una puerta.`, {
      profundidad: Math.round(profundidad),
      faltan,
    })
  }
  const ancho = geo.valor({ tipo: 'ref', ref: c.derecha, mas: 0 }, 'x') - geo.valor({ tipo: 'ref', ref: c.izquierda, mas: 0 }, 'x')
  const alto = geo.valor({ tipo: 'ref', ref: c.arriba, mas: 0 }, 'y') - geo.valor({ tipo: 'ref', ref: c.abajo, mas: 0 }, 'y')
  if (ancho < 2 * corredera.holguraLateral + 150 || alto < HOLGURA_ABAJO + HOLGURA_ARRIBA + 60)
    return error('E_OPERACION_INVALIDA', `El hueco de ${Math.round(ancho)} × ${Math.round(alto)} mm es muy chico para un cajón.`, { ancho: Math.round(ancho), alto: Math.round(alto) })

  const g = c.grupo
  const id = (parte: string) => `${g}-${parte}`
  const lado = corredera.holguraLateral
  const comun = { material: c.material, grupo: g, confianza: 'alta' as const }
  /** The box runs from behind the front, as long as the runner. */
  const caja = () => (atras ? tramo(ref(`${id('frente')}.z1`), null, corredera.largo) : tramo(null, ref(`${id('frente')}.z0`), corredera.largo))
  const piezas: Pieza[] = [
    pieza({
      ...comun,
      id: id('frente'),
      nombre: `Frente de ${c.nombre.toLowerCase()}`,
      rol: 'frente-cajon',
      normal: 'z',
      x: tramo(ref(c.izquierda, HOLGURA_FRENTE), ref(c.derecha, -HOLGURA_FRENTE)),
      y: tramo(ref(c.abajo, HOLGURA_FRENTE), ref(c.arriba, -HOLGURA_FRENTE)),
      z: atras ? desde(ref(c.frente)) : hasta(ref(c.frente)),
      cantos: ['frente', 'izq', 'der', 'arriba', 'abajo'],
    }),
    pieza({ ...comun, material: c.materialFondo, id: id('fondo'), nombre: `Fondo de ${c.nombre.toLowerCase()}`, rol: 'fondo-cajon', normal: 'y', x: tramo(ref(c.izquierda, lado), ref(c.derecha, -lado)), y: desde(ref(c.abajo, HOLGURA_ABAJO)), z: caja(), veta: 'libre' }),
    pieza({ ...comun, id: id('costado-izq'), nombre: `Costado izquierdo de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'x', x: desde(ref(c.izquierda, lado)), y: tramo(ref(`${id('fondo')}.y1`), ref(c.arriba, -HOLGURA_ARRIBA)), z: caja(), cantos: ['arriba'] }),
    pieza({ ...comun, id: id('costado-der'), nombre: `Costado derecho de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'x', x: hasta(ref(c.derecha, -lado)), y: tramo(ref(`${id('fondo')}.y1`), ref(c.arriba, -HOLGURA_ARRIBA)), z: caja(), cantos: ['arriba'] }),
    pieza({ ...comun, id: id('contra'), nombre: `Contrafrente de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'z', x: tramo(ref(`${id('costado-izq')}.x1`), ref(`${id('costado-der')}.x0`)), y: tramo(ref(`${id('fondo')}.y1`), ref(c.arriba, -HOLGURA_ARRIBA)), z: atras ? desde(ref(`${id('frente')}.z1`)) : hasta(ref(`${id('frente')}.z0`)), cantos: ['arriba'] }),
    pieza({ ...comun, id: id('trasera'), nombre: `Trasera de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'z', x: tramo(ref(`${id('costado-izq')}.x1`), ref(`${id('costado-der')}.x0`)), y: tramo(ref(`${id('fondo')}.y1`), ref(c.arriba, -HOLGURA_ARRIBA)), z: atras ? hasta(ref(`${id('costado-izq')}.z1`)) : desde(ref(`${id('costado-izq')}.z0`)), cantos: ['arriba'] }),
  ]

  const tornillo = [{ herrajeId: 'tornillo-8x2', cantidad: null }]
  const uniones: Union[] = [
    ...['contra', 'trasera'].flatMap((b) => ['costado-izq', 'costado-der'].map((a) => union(`u-${g}-${a}-${b}`, id(a), id(b), 'tope-tornillo', tornillo))),
    union(`u-${g}-contra-frente`, id('contra'), id('frente'), 'tope-tornillo', [{ herrajeId: 'tornillo-8x1', cantidad: 4 }]),
    ...['costado-izq', 'costado-der', 'contra', 'trasera'].map((b) => union(`u-${g}-fondo-${b}`, id('fondo'), id(b), 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
  ]
  const soporteIzq = parseCara(c.izquierda).pieza
  const soporteDer = parseCara(c.derecha).pieza
  if (soporteIzq !== 'mueble') uniones.push(union(`u-${g}-corredera-izq`, id('costado-izq'), soporteIzq, 'corredera', [{ herrajeId: corredera.id, cantidad: 1 }]))
  if (soporteDer !== 'mueble') uniones.push(union(`u-${g}-corredera-der`, id('costado-der'), soporteDer, 'corredera', []))
  return { piezas, uniones }
}
