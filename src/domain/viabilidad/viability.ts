import { z } from 'zod'
import { DIMENSION_LABEL, type Design } from '../diseno/schema'
import { faceSize, roundTo, type Geometry } from '../diseno/resolve'
import type { Finding } from '../structure/finding'
import type { Catalog } from '../materiales/catalog'
import type { Purchase } from '../materiales/purchase'

// The review before buying: what can be checked with arithmetic, no opinions. The carpenter (the model) gives an opinion on top of it, never against it.
// Check ids are saved in the verdict: renaming one needs a migration.

/** Narrower than this, a strip is dangerous to cut with a circular saw at home. */
export const MIN_STRIP = 50
/** From this use of the usable sheet up, one wrong cut means buying another sheet. */
export const TIGHT_YIELD = 0.85
const MEASURE_TOLERANCE = 2

export const Verdict = z.enum(['viable', 'needs-changes', 'not-viable'])
export type Verdict = z.infer<typeof Verdict>

export const Check = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['ok', 'warning', 'fail']),
  detail: z.string(),
  pieces: z.array(z.string()),
  /** Lo que se le pide al experto para arreglarlo, si hay un arreglo claro. */
  request: z.string().nullable(),
  /** Una falla imposible (no cabe, no cierra) hace el diseño no viable; las demás piden cambios. */
  impossible: z.boolean(),
})
export type Check = z.infer<typeof Check>

export const CarpenterOpinion = z.object({
  verdict: Verdict.describe('viable: can be bought and built like this; needs-changes: something must be fixed first; not-viable: has a fundamental error'),
  summary: z.string().describe('The verdict in 1 or 2 sentences, in Spanish, as you would tell the person in the workshop'),
  problems: z.array(
    z.object({
      title: z.string().describe('In 3 to 6 words, in Spanish'),
      detail: z.string().describe('What happens, why it matters and how to fix it, in 1 to 3 sentences, in Spanish'),
      severity: z.enum(['high', 'medium', 'low']).describe('high: cannot be built or is unsafe; medium: will fail with use; low: worth improving'),
      pieces: z.array(z.string()).describe('Ids of the pieces involved'),
      request: z.string().nullable().describe('The change to ask the expert for in the chat, in Spanish, as the person would ask it; null if there is no clear fix'),
    }),
  ),
  tips: z.array(z.string()).describe('2 to 4 tips, in Spanish, for buying, cutting and building this particular piece of furniture'),
})
export type CarpenterOpinion = z.infer<typeof CarpenterOpinion>

export const Viability = z.object({ verdict: Verdict, checks: z.array(Check) })
export type Viability = z.infer<typeof Viability>

interface ViabilityInput {
  design: Design
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

const check = (c: Omit<Check, 'pieces' | 'request' | 'impossible'> & Partial<Check>): Check => ({ pieces: [], request: null, impossible: false, ...c })

function measures({ design, geo }: ViabilityInput): Check {
  const boxes = [...geo.boxes.values()]
  const span = (e: 'x' | 'y' | 'z') => Math.max(...boxes.map((c) => c[`${e}1`])) - Math.min(...boxes.map((c) => c[`${e}0`]))
  const real = { width: span('x'), height: span('y'), depth: span('z') }
  const { width: ancho, height: alto, depth: fondo } = design.dimensions
  const off = (['height', 'width', 'depth'] as const).filter((k) => Math.abs(real[k] - design.dimensions[k]) > MEASURE_TOLERANCE)
  if (!off.length) return check({ id: 'measures', title: 'Las medidas cierran', status: 'ok', detail: `Las piezas suman exacto ${alto} × ${ancho} × ${fondo} mm (alto, ancho, fondo).` })
  return check({
    id: 'measures',
    title: 'Las medidas no cierran',
    status: 'fail',
    impossible: true,
    detail: `Las piezas suman ${roundTo(real.height)} × ${roundTo(real.width)} × ${roundTo(real.depth)} mm y el mueble dice ${alto} × ${ancho} × ${fondo} mm; no coincide el ${off.map((k) => DIMENSION_LABEL[k]).join(' ni el ')}.`,
    request: `Haz que las piezas cierren exacto en ${alto} × ${ancho} × ${fondo} mm`,
  })
}

function sheet({ catalog, purchase }: ViabilityInput): Check {
  const trim = catalog.acomodo.refilado
  const unplaced = purchase.layout.flatMap((a) => a.unplaced.map((p) => ({ ...p, usable: a.usable })))
  if (!unplaced.length) {
    const usable = purchase.layout[0]?.usable
    return check({
      id: 'sheet',
      title: 'Todo cabe en la hoja',
      status: 'ok',
      detail: usable ? `Cada pieza cabe en la parte buena de la hoja (${usable.largo} × ${usable.ancho} mm), ya sin los ${trim} mm por orilla que se recortan.` : 'No hay piezas de triplay que acomodar.',
    })
  }
  const p = unplaced[0]
  return check({
    id: 'sheet',
    title: 'Hay piezas más grandes que la hoja',
    status: 'fail',
    impossible: true,
    pieces: unplaced.map((x) => x.id),
    detail: `${listed(unplaced.map((x) => x.name))}: ${p.name.toLowerCase()} mide ${roundTo(p.length)} × ${roundTo(p.width)} mm y lo más que sale de una hoja es ${p.usable.largo} × ${p.usable.ancho} mm (se recortan ${trim} mm por orilla).`,
    request: `Haz que ${p.name.toLowerCase()} quepa en una hoja: máximo ${p.usable.largo} × ${p.usable.ancho} mm`,
  })
}

function strips({ design, geo }: ViabilityInput): Check {
  const narrow = design.pieces.filter((p) => {
    const box = geo.boxes.get(p.id)
    return box && Math.min(...faceSize(box, p.normal)) < MIN_STRIP
  })
  if (!narrow.length) return check({ id: 'strips', title: 'Cortes seguros', status: 'ok', detail: `Ninguna pieza es una tira de menos de ${cm(MIN_STRIP)}, que son las riesgosas de cortar.` })
  return check({
    id: 'strips',
    title: 'Tiras angostas',
    status: 'warning',
    pieces: narrow.map((p) => p.id),
    detail: `${listed(narrow.map((p) => p.name))} ${narrow.length === 1 ? 'mide' : 'miden'} menos de ${cm(MIN_STRIP)} de ancho. Con sierra circular es peligroso: pídelas cortadas en la tienda o sácalas de un sobrante ancho.`,
  })
}

function structure({ findings, unmet }: ViabilityInput): Check {
  const critical = findings.filter((h) => h.severity === 'critical')
  const recommended = findings.filter((h) => h.severity === 'recommendation')
  if (critical.length || unmet.length) {
    const messages = [...unmet, ...critical.map((h) => h.message)]
    const first = critical[0]?.alternatives[0]
    return check({
      id: 'structure',
      title: critical.length + unmet.length === 1 ? 'Un problema de estructura' : `${critical.length + unmet.length} problemas de estructura`,
      status: 'fail',
      pieces: [...new Set(critical.flatMap((h) => h.pieces))],
      detail: messages.slice(0, 3).join(' '),
      request: first ? first.description : null,
    })
  }
  if (recommended.length)
    return check({
      id: 'structure',
      title: 'Estructura firme, con recomendaciones',
      status: 'warning',
      pieces: [...new Set(recommended.flatMap((h) => h.pieces))],
      detail: `Aguanta, pero hay ${recommended.length === 1 ? 'una mejora recomendada' : `${recommended.length} mejoras recomendadas`}: ${recommended[0].message}`,
    })
  return check({ id: 'structure', title: 'Estructura firme', status: 'ok', detail: 'Repisas, uniones, estabilidad y base pasan la revisión estructural.' })
}

function confirmed({ design }: ViabilityInput): Check {
  const sketched = design.pieces.filter((p) => p.confidence === 'low')
  if (!sketched.length) return check({ id: 'confirmed', title: 'Piezas confirmadas', status: 'ok', detail: 'No queda ninguna pieza en boceto.' })
  return check({
    id: 'confirmed',
    title: 'Piezas por confirmar',
    status: 'warning',
    pieces: sketched.map((p) => p.id),
    detail: `${listed(sketched.map((p) => p.name))} ${sketched.length === 1 ? 'sigue' : 'siguen'} en boceto: contesta las dudas del experto antes de cortar.`,
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
  if (!tight.length) return check({ id: 'margin', title: 'Material de sobra', status: 'ok', detail: 'Si un corte sale mal, queda sobrante para repetirlo.' })
  return check({
    id: 'margin',
    title: 'Vas justo de material',
    status: 'warning',
    detail: `${tight.map((j) => `${j.name} (aprovechas ${Math.round(j.used * 100)} %)`).join(', ')}: si un corte sale mal no hay de dónde sacar. Considera comprar una hoja de más.`,
  })
}

/** What the person accepted is not a failure any more, but the verdict still says it. */
function acceptedByPerson({ accepted = [] }: ViabilityInput): Check[] {
  const titles = [...new Set(accepted)]
  return titles.length ? [check({ id: 'aceptados', title: 'Aceptado por ti', status: 'warning', detail: `Lo dejaste así, bajo tu riesgo: ${titles.join(', ')}.` })] : []
}

/** The arithmetic checks, the most serious first. */
export function reviewViability(input: ViabilityInput): Viability {
  const checks = [...[measures, sheet, structure, strips, confirmed, margin].map((f) => f(input)), ...acceptedByPerson(input)]
  return { verdict: verdictOf(checks), checks: checks }
}

export function verdictOf(checks: Check[]): Verdict {
  const failed = checks.filter((c) => c.status === 'fail')
  return failed.some((c) => c.impossible) ? 'not-viable' : failed.length ? 'needs-changes' : 'viable'
}

const SEVERITY: Record<Verdict, number> = { viable: 0, 'needs-changes': 1, 'not-viable': 2 }
/** The carpenter may be stricter than the arithmetic, never more lenient. */
export const worst = (a: Verdict, b: Verdict): Verdict => (SEVERITY[a] >= SEVERITY[b] ? a : b)
