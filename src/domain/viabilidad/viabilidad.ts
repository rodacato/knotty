import { z } from 'zod'
import type { Diseno } from '../diseno/esquema'
import { medidasCara, redondear, type Geometria } from '../diseno/resolver'
import type { Hallazgo } from '../estructura/hallazgo'
import type { Catalogo } from '../materiales/catalogo'
import type { Compra } from '../materiales/compra'

// La revisión antes de comprar: lo que se puede comprobar con cuentas, sin opinión. El carpintero (LLM) opina encima de esto, nunca en contra.

/** Menos de esto es una tira peligrosa de cortar con sierra circular en casa. */
export const TIRA_MINIMA = 50
/** A partir de este aprovechamiento de la hoja útil, un corte equivocado obliga a comprar otra hoja. */
export const APROVECHAMIENTO_JUSTO = 0.85
const TOLERANCIA_MEDIDAS = 2

export const Veredicto = z.enum(['viable', 'con-cambios', 'no-viable'])
export type Veredicto = z.infer<typeof Veredicto>

export const Comprobacion = z.object({
  id: z.string(),
  titulo: z.string(),
  estado: z.enum(['ok', 'aviso', 'falla']),
  detalle: z.string(),
  piezas: z.array(z.string()),
  /** Lo que se le pide al experto para arreglarlo, si hay un arreglo claro. */
  pedido: z.string().nullable(),
  /** Una falla imposible (no cabe, no cierra) hace el diseño no viable; las demás piden cambios. */
  imposible: z.boolean(),
})
export type Comprobacion = z.infer<typeof Comprobacion>

export const OpinionCarpintero = z.object({
  veredicto: Veredicto.describe('viable: se puede comprar y armar así; con-cambios: hay que arreglar algo antes; no-viable: tiene un error de origen'),
  resumen: z.string().describe('El dictamen en 1 o 2 frases, como se lo dirías a la persona en el taller'),
  problemas: z.array(
    z.object({
      titulo: z.string().describe('En 3 a 6 palabras'),
      detalle: z.string().describe('Qué pasa, por qué importa y cómo se arregla, en 1 a 3 frases'),
      gravedad: z.enum(['alta', 'media', 'baja']).describe('alta: no se puede armar o es inseguro; media: va a fallar con el uso; baja: conviene mejorarlo'),
      piezas: z.array(z.string()).describe('Ids de las piezas involucradas'),
      pedido: z.string().nullable().describe('El cambio para pedirle al experto en el chat, escrito como lo pediría la persona; null si no hay un arreglo claro'),
    }),
  ),
  consejos: z.array(z.string()).describe('2 a 4 consejos para comprar, cortar y armar este mueble en particular'),
})
export type OpinionCarpintero = z.infer<typeof OpinionCarpintero>

export const Viabilidad = z.object({ veredicto: Veredicto, comprobaciones: z.array(Comprobacion) })
export type Viabilidad = z.infer<typeof Viabilidad>

interface Entrada {
  diseno: Diseno
  geo: Geometria
  /** Con los ajustes de corte de la persona: el refilado cambia lo que cabe. */
  catalogo: Catalogo
  compra: Compra
  hallazgos: Hallazgo[]
  incumplidos: string[]
  /** Titles of findings the person chose to leave as they are. */
  accepted?: string[]
}

const cm = (mm: number) => `${redondear(mm / 10, 1)} cm`
const lista = (nombres: string[]) => (nombres.length <= 3 ? nombres.join(', ') : `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más`)

const comprobacion = (c: Omit<Comprobacion, 'piezas' | 'pedido' | 'imposible'> & Partial<Comprobacion>): Comprobacion => ({ piezas: [], pedido: null, imposible: false, ...c })

function medidas({ diseno, geo }: Entrada): Comprobacion {
  const cajas = [...geo.cajas.values()]
  const extension = (e: 'x' | 'y' | 'z') => Math.max(...cajas.map((c) => c[`${e}1`])) - Math.min(...cajas.map((c) => c[`${e}0`]))
  const real = { ancho: extension('x'), alto: extension('y'), fondo: extension('z') }
  const { ancho, alto, fondo } = diseno.dimensiones
  const difieren = (['alto', 'ancho', 'fondo'] as const).filter((k) => Math.abs(real[k] - diseno.dimensiones[k]) > TOLERANCIA_MEDIDAS)
  if (!difieren.length) return comprobacion({ id: 'medidas', titulo: 'Las medidas cierran', estado: 'ok', detalle: `Las piezas suman exacto ${alto} × ${ancho} × ${fondo} mm (alto, ancho, fondo).` })
  return comprobacion({
    id: 'medidas',
    titulo: 'Las medidas no cierran',
    estado: 'falla',
    imposible: true,
    detalle: `Las piezas suman ${redondear(real.alto)} × ${redondear(real.ancho)} × ${redondear(real.fondo)} mm y el mueble dice ${alto} × ${ancho} × ${fondo} mm; no coincide el ${difieren.join(' ni el ')}.`,
    pedido: `Haz que las piezas cierren exacto en ${alto} × ${ancho} × ${fondo} mm`,
  })
}

function hoja({ catalogo, compra }: Entrada): Comprobacion {
  const refilado = catalogo.acomodo.refilado
  const sinLugar = compra.acomodo.flatMap((a) => a.sinLugar.map((p) => ({ ...p, util: a.util })))
  if (!sinLugar.length) {
    const util = compra.acomodo[0]?.util
    return comprobacion({
      id: 'hoja',
      titulo: 'Todo cabe en la hoja',
      estado: 'ok',
      detalle: util ? `Cada pieza cabe en la parte buena de la hoja (${util.largo} × ${util.ancho} mm), ya sin los ${refilado} mm por orilla que se recortan.` : 'No hay piezas de triplay que acomodar.',
    })
  }
  const p = sinLugar[0]
  return comprobacion({
    id: 'hoja',
    titulo: 'Hay piezas más grandes que la hoja',
    estado: 'falla',
    imposible: true,
    piezas: sinLugar.map((x) => x.id),
    detalle: `${lista(sinLugar.map((x) => x.nombre))}: ${p.nombre.toLowerCase()} mide ${redondear(p.largo)} × ${redondear(p.ancho)} mm y lo más que sale de una hoja es ${p.util.largo} × ${p.util.ancho} mm (se recortan ${refilado} mm por orilla).`,
    pedido: `Haz que ${p.nombre.toLowerCase()} quepa en una hoja: máximo ${p.util.largo} × ${p.util.ancho} mm`,
  })
}

function tiras({ diseno, geo }: Entrada): Comprobacion {
  const angostas = diseno.piezas.filter((p) => {
    const caja = geo.cajas.get(p.id)
    return caja && Math.min(...medidasCara(caja, p.normal)) < TIRA_MINIMA
  })
  if (!angostas.length) return comprobacion({ id: 'tiras', titulo: 'Cortes seguros', estado: 'ok', detalle: `Ninguna pieza es una tira de menos de ${cm(TIRA_MINIMA)}, que son las riesgosas de cortar.` })
  return comprobacion({
    id: 'tiras',
    titulo: 'Tiras angostas',
    estado: 'aviso',
    piezas: angostas.map((p) => p.id),
    detalle: `${lista(angostas.map((p) => p.nombre))} ${angostas.length === 1 ? 'mide' : 'miden'} menos de ${cm(TIRA_MINIMA)} de ancho. Con sierra circular es peligroso: pídelas cortadas en la tienda o sácalas de un sobrante ancho.`,
  })
}

function estructura({ hallazgos, incumplidos }: Entrada): Comprobacion {
  const criticos = hallazgos.filter((h) => h.severidad === 'critico')
  const recomendaciones = hallazgos.filter((h) => h.severidad === 'recomendacion')
  if (criticos.length || incumplidos.length) {
    const mensajes = [...incumplidos, ...criticos.map((h) => h.mensaje)]
    const primero = criticos[0]?.alternativas[0]
    return comprobacion({
      id: 'estructura',
      titulo: criticos.length + incumplidos.length === 1 ? 'Un problema de estructura' : `${criticos.length + incumplidos.length} problemas de estructura`,
      estado: 'falla',
      piezas: [...new Set(criticos.flatMap((h) => h.piezas))],
      detalle: mensajes.slice(0, 3).join(' '),
      pedido: primero ? primero.descripcion : null,
    })
  }
  if (recomendaciones.length)
    return comprobacion({
      id: 'estructura',
      titulo: 'Estructura firme, con recomendaciones',
      estado: 'aviso',
      piezas: [...new Set(recomendaciones.flatMap((h) => h.piezas))],
      detalle: `Aguanta, pero hay ${recomendaciones.length === 1 ? 'una mejora recomendada' : `${recomendaciones.length} mejoras recomendadas`}: ${recomendaciones[0].mensaje}`,
    })
  return comprobacion({ id: 'estructura', titulo: 'Estructura firme', estado: 'ok', detalle: 'Repisas, uniones, estabilidad y base pasan la revisión estructural.' })
}

function confirmadas({ diseno }: Entrada): Comprobacion {
  const boceto = diseno.piezas.filter((p) => p.confianza === 'baja')
  if (!boceto.length) return comprobacion({ id: 'confirmadas', titulo: 'Piezas confirmadas', estado: 'ok', detalle: 'No queda ninguna pieza en boceto.' })
  return comprobacion({
    id: 'confirmadas',
    titulo: 'Piezas por confirmar',
    estado: 'aviso',
    piezas: boceto.map((p) => p.id),
    detalle: `${lista(boceto.map((p) => p.nombre))} ${boceto.length === 1 ? 'sigue' : 'siguen'} en boceto: contesta las dudas del experto antes de cortar.`,
  })
}

function margen({ catalogo, compra }: Entrada): Comprobacion {
  const justos = compra.acomodo.flatMap((a) => {
    const hojas = a.hojas.length
    if (!hojas) return []
    const usado = a.hojas.reduce((s, h) => s + h.colocadas.reduce((t, c) => t + c.w * c.h, 0), 0) / (hojas * a.util.largo * a.util.ancho)
    const material = catalogo.materiales.find((m) => m.id === a.material)
    return usado >= APROVECHAMIENTO_JUSTO ? [{ nombre: material?.nombre ?? a.material, usado }] : []
  })
  if (!justos.length) return comprobacion({ id: 'margen', titulo: 'Material de sobra', estado: 'ok', detalle: 'Si un corte sale mal, queda sobrante para repetirlo.' })
  return comprobacion({
    id: 'margen',
    titulo: 'Vas justo de material',
    estado: 'aviso',
    detalle: `${justos.map((j) => `${j.nombre} (aprovechas ${Math.round(j.usado * 100)} %)`).join(', ')}: si un corte sale mal no hay de dónde sacar. Considera comprar una hoja de más.`,
  })
}

/** Las comprobaciones de cuentas, de la más grave a la más leve. */
/** What the person accepted is not a failure any more, but the verdict still says it. */
function acceptedByPerson({ accepted = [] }: Entrada): Comprobacion[] {
  const titles = [...new Set(accepted)]
  return titles.length ? [comprobacion({ id: 'aceptados', titulo: 'Aceptado por ti', estado: 'aviso', detalle: `Lo dejaste así, bajo tu riesgo: ${titles.join(', ')}.` })] : []
}

export function revisarViabilidad(entrada: Entrada): Viabilidad {
  const comprobaciones = [...[medidas, hoja, estructura, tiras, confirmadas, margen].map((f) => f(entrada)), ...acceptedByPerson(entrada)]
  return { veredicto: veredictoDe(comprobaciones), comprobaciones }
}

export function veredictoDe(comprobaciones: Comprobacion[]): Veredicto {
  const fallas = comprobaciones.filter((c) => c.estado === 'falla')
  return fallas.some((c) => c.imposible) ? 'no-viable' : fallas.length ? 'con-cambios' : 'viable'
}

const GRAVEDAD: Record<Veredicto, number> = { viable: 0, 'con-cambios': 1, 'no-viable': 2 }
/** El carpintero puede ser más estricto que las cuentas, nunca más permisivo. */
export const peor = (a: Veredicto, b: Veredicto): Veredicto => (GRAVEDAD[a] >= GRAVEDAD[b] ? a : b)
