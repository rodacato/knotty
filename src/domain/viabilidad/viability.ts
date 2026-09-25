import { z } from 'zod'
import type { Diseno } from '../diseno/esquema'
import { faceSize, roundTo, type Geometry } from '../diseno/resolve'
import type { Finding } from '../structure/finding'
import type { Catalog } from '../materiales/catalog'
import type { Purchase } from '../materiales/purchase'

// The review before buying: what can be checked with arithmetic, no opinions. The carpenter (the model) gives an opinion on top of it, never against it.
// Check ids, states and the verdict's values are saved in the verdict: they stay as they are.

/** Narrower than this, a strip is dangerous to cut with a circular saw at home. */
export const MIN_STRIP = 50
/** From this use of the usable sheet up, one wrong cut means buying another sheet. */
export const TIGHT_YIELD = 0.85
const MEASURE_TOLERANCE = 2

export const Verdict = z.enum(['viable', 'con-cambios', 'no-viable'])
export type Verdict = z.infer<typeof Verdict>

export const Check = z.object({
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
export type Check = z.infer<typeof Check>

export const CarpenterOpinion = z.object({
  veredicto: Verdict.describe('viable: se puede comprar y armar así; con-cambios: hay que arreglar algo antes; no-viable: tiene un error de origen'),
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
export type CarpenterOpinion = z.infer<typeof CarpenterOpinion>

export const Viability = z.object({ veredicto: Verdict, comprobaciones: z.array(Check) })
export type Viability = z.infer<typeof Viability>

interface ViabilityInput {
  design: Diseno
  geo: Geometry
  /** With the person's cutting settings: the trim changes what fits. */
  catalog: Catalog
  purchase: Purchase
  findings: Finding[]
  unmet: string[]
  /** Titles of findings the person chose to leave as they are. */
  accepted?: string[]
}

const cm = (mm: number) => `${roundTo(mm / 10, 1)} cm`
const listed = (names: string[]) => (names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} y ${names.length - 3} más`)

const check = (c: Omit<Check, 'piezas' | 'pedido' | 'imposible'> & Partial<Check>): Check => ({ piezas: [], pedido: null, imposible: false, ...c })

function measures({ design, geo }: ViabilityInput): Check {
  const boxes = [...geo.boxes.values()]
  const span = (e: 'x' | 'y' | 'z') => Math.max(...boxes.map((c) => c[`${e}1`])) - Math.min(...boxes.map((c) => c[`${e}0`]))
  const real = { ancho: span('x'), alto: span('y'), fondo: span('z') }
  const { ancho, alto, fondo } = design.dimensiones
  const off = (['alto', 'ancho', 'fondo'] as const).filter((k) => Math.abs(real[k] - design.dimensiones[k]) > MEASURE_TOLERANCE)
  if (!off.length) return check({ id: 'medidas', titulo: 'Las medidas cierran', estado: 'ok', detalle: `Las piezas suman exacto ${alto} × ${ancho} × ${fondo} mm (alto, ancho, fondo).` })
  return check({
    id: 'medidas',
    titulo: 'Las medidas no cierran',
    estado: 'falla',
    imposible: true,
    detalle: `Las piezas suman ${roundTo(real.alto)} × ${roundTo(real.ancho)} × ${roundTo(real.fondo)} mm y el mueble dice ${alto} × ${ancho} × ${fondo} mm; no coincide el ${off.join(' ni el ')}.`,
    pedido: `Haz que las piezas cierren exacto en ${alto} × ${ancho} × ${fondo} mm`,
  })
}

function sheet({ catalog, purchase }: ViabilityInput): Check {
  const trim = catalog.acomodo.refilado
  const unplaced = purchase.layout.flatMap((a) => a.unplaced.map((p) => ({ ...p, usable: a.usable })))
  if (!unplaced.length) {
    const usable = purchase.layout[0]?.usable
    return check({
      id: 'hoja',
      titulo: 'Todo cabe en la hoja',
      estado: 'ok',
      detalle: usable ? `Cada pieza cabe en la parte buena de la hoja (${usable.largo} × ${usable.ancho} mm), ya sin los ${trim} mm por orilla que se recortan.` : 'No hay piezas de triplay que acomodar.',
    })
  }
  const p = unplaced[0]
  return check({
    id: 'hoja',
    titulo: 'Hay piezas más grandes que la hoja',
    estado: 'falla',
    imposible: true,
    piezas: unplaced.map((x) => x.id),
    detalle: `${listed(unplaced.map((x) => x.name))}: ${p.name.toLowerCase()} mide ${roundTo(p.length)} × ${roundTo(p.width)} mm y lo más que sale de una hoja es ${p.usable.largo} × ${p.usable.ancho} mm (se recortan ${trim} mm por orilla).`,
    pedido: `Haz que ${p.name.toLowerCase()} quepa en una hoja: máximo ${p.usable.largo} × ${p.usable.ancho} mm`,
  })
}

function strips({ design, geo }: ViabilityInput): Check {
  const narrow = design.piezas.filter((p) => {
    const box = geo.boxes.get(p.id)
    return box && Math.min(...faceSize(box, p.normal)) < MIN_STRIP
  })
  if (!narrow.length) return check({ id: 'tiras', titulo: 'Cortes seguros', estado: 'ok', detalle: `Ninguna pieza es una tira de menos de ${cm(MIN_STRIP)}, que son las riesgosas de cortar.` })
  return check({
    id: 'tiras',
    titulo: 'Tiras angostas',
    estado: 'aviso',
    piezas: narrow.map((p) => p.id),
    detalle: `${listed(narrow.map((p) => p.nombre))} ${narrow.length === 1 ? 'mide' : 'miden'} menos de ${cm(MIN_STRIP)} de ancho. Con sierra circular es peligroso: pídelas cortadas en la tienda o sácalas de un sobrante ancho.`,
  })
}

function structure({ findings, unmet }: ViabilityInput): Check {
  const critical = findings.filter((h) => h.severity === 'critico')
  const recommended = findings.filter((h) => h.severity === 'recomendacion')
  if (critical.length || unmet.length) {
    const messages = [...unmet, ...critical.map((h) => h.message)]
    const first = critical[0]?.alternatives[0]
    return check({
      id: 'estructura',
      titulo: critical.length + unmet.length === 1 ? 'Un problema de estructura' : `${critical.length + unmet.length} problemas de estructura`,
      estado: 'falla',
      piezas: [...new Set(critical.flatMap((h) => h.pieces))],
      detalle: messages.slice(0, 3).join(' '),
      pedido: first ? first.description : null,
    })
  }
  if (recommended.length)
    return check({
      id: 'estructura',
      titulo: 'Estructura firme, con recomendaciones',
      estado: 'aviso',
      piezas: [...new Set(recommended.flatMap((h) => h.pieces))],
      detalle: `Aguanta, pero hay ${recommended.length === 1 ? 'una mejora recomendada' : `${recommended.length} mejoras recomendadas`}: ${recommended[0].message}`,
    })
  return check({ id: 'estructura', titulo: 'Estructura firme', estado: 'ok', detalle: 'Repisas, uniones, estabilidad y base pasan la revisión estructural.' })
}

function confirmed({ design }: ViabilityInput): Check {
  const sketched = design.piezas.filter((p) => p.confianza === 'baja')
  if (!sketched.length) return check({ id: 'confirmadas', titulo: 'Piezas confirmadas', estado: 'ok', detalle: 'No queda ninguna pieza en boceto.' })
  return check({
    id: 'confirmadas',
    titulo: 'Piezas por confirmar',
    estado: 'aviso',
    piezas: sketched.map((p) => p.id),
    detalle: `${listed(sketched.map((p) => p.nombre))} ${sketched.length === 1 ? 'sigue' : 'siguen'} en boceto: contesta las dudas del experto antes de cortar.`,
  })
}

function margin({ catalog, purchase }: ViabilityInput): Check {
  const tight = purchase.layout.flatMap((a) => {
    const sheets = a.sheets.length
    if (!sheets) return []
    const used = a.sheets.reduce((s, h) => s + h.placed.reduce((t, c) => t + c.w * c.h, 0), 0) / (sheets * a.usable.largo * a.usable.ancho)
    const material = catalog.materiales.find((m) => m.id === a.material)
    return used >= TIGHT_YIELD ? [{ name: material?.nombre ?? a.material, used }] : []
  })
  if (!tight.length) return check({ id: 'margen', titulo: 'Material de sobra', estado: 'ok', detalle: 'Si un corte sale mal, queda sobrante para repetirlo.' })
  return check({
    id: 'margen',
    titulo: 'Vas justo de material',
    estado: 'aviso',
    detalle: `${tight.map((j) => `${j.name} (aprovechas ${Math.round(j.used * 100)} %)`).join(', ')}: si un corte sale mal no hay de dónde sacar. Considera comprar una hoja de más.`,
  })
}

/** What the person accepted is not a failure any more, but the verdict still says it. */
function acceptedByPerson({ accepted = [] }: ViabilityInput): Check[] {
  const titles = [...new Set(accepted)]
  return titles.length ? [check({ id: 'aceptados', titulo: 'Aceptado por ti', estado: 'aviso', detalle: `Lo dejaste así, bajo tu riesgo: ${titles.join(', ')}.` })] : []
}

/** The arithmetic checks, the most serious first. */
export function reviewViability(input: ViabilityInput): Viability {
  const checks = [...[measures, sheet, structure, strips, confirmed, margin].map((f) => f(input)), ...acceptedByPerson(input)]
  return { veredicto: verdictOf(checks), comprobaciones: checks }
}

export function verdictOf(checks: Check[]): Verdict {
  const failed = checks.filter((c) => c.estado === 'falla')
  return failed.some((c) => c.imposible) ? 'no-viable' : failed.length ? 'con-cambios' : 'viable'
}

const SEVERITY: Record<Verdict, number> = { viable: 0, 'con-cambios': 1, 'no-viable': 2 }
/** The carpenter may be stricter than the arithmetic, never more lenient. */
export const worst = (a: Verdict, b: Verdict): Verdict => (SEVERITY[a] >= SEVERITY[b] ? a : b)
