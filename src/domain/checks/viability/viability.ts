import { z } from 'zod'
import { DIMENSION_LABEL, DIMENSION_OF_AXIS, type Axis, type Design } from '../../design/schema'
import { faceSize, roundTo, type Geometry } from '../../design/resolve'
import { bounds } from '../../design/boxes'
import type { Analysis } from '../analysis'
import type { Finding } from '../structure/finding'
import type { DesignError } from '../../design/validation/errors'
import type { Catalog } from '../../materials/catalog'
import type { Purchase } from '../../materials/purchase'
import { noReference, type Source } from '../../sources'

// The review before buying: what can be checked with arithmetic, no opinions. The carpenter (the model) gives an opinion on top of it, never against it.
// Check ids are saved in the verdict: renaming one needs a migration.
// Four vocabularies, one per reader: a DesignError says the pieces are not a piece of furniture yet (the expert fixes it); a Finding is a structural rule's notice
// (critical, recommendation, detail); a Check is what the person reads here before buying (ok, warning, fail); the carpenter's problems (high, medium, low) are
// the model's opinion. The review never re-derives the first two: it shows what analyze() found (`checkOfError` says where each error goes) and adds what only
// the purchase knows: the person's cutting settings, the layout on the sheets and the material margin.

/** Narrower than this, a strip is dangerous to cut with a circular saw at home. */
const MIN_STRIP = 50
/** From this use of the usable sheet up, one wrong cut means buying another sheet. */
const TIGHT_YIELD = 0.85
export const VIABILITY_SOURCES: Record<string, Source> = {
  MIN_STRIP: noReference('Knotty’s limit for a strip safe to rip with a circular saw at home; the reference gives no minimum width'),
  TIGHT_YIELD: noReference('Knotty’s margin for one miscut before another sheet is needed'),
}

export const Verdict = z.enum(['viable', 'needs-changes', 'not-viable'])
export type Verdict = z.infer<typeof Verdict>

export const Check = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['ok', 'warning', 'fail']),
  detail: z.string(),
  pieces: z.array(z.string()),
  /** What the expert is asked to fix it, when there is a clear fix. */
  request: z.string().nullable(),
  /** An impossible failure (it does not fit, it does not add up) makes the design not viable; the others ask for changes. */
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

const Viability = z.object({ verdict: Verdict, checks: z.array(Check) })
type Viability = z.infer<typeof Viability>

type CheckId = 'measures' | 'sheet' | 'structure'

/** The check that shows an analysis error: its own for the size errors; any other means it cannot be built as drawn, a structure problem. */
const checkOfError = (e: DesignError): CheckId => (e.code === 'E_OVERALL_SIZE' ? 'measures' : e.code === 'E_TOO_BIG_FOR_SHEET' ? 'sheet' : 'structure')

interface ViabilityInput {
  design: Design
  /** analyze() of the design, with its geometry. An invalid one still gets a review: each error shows once, as a failed check. */
  analysis: Analysis & { geo: Geometry }
  /** With the person's cutting settings: the trim changes what fits. */
  catalog: Catalog
  purchase: Purchase
  /** The analysis' findings the person has not accepted; all of them when left out. */
  findings?: Finding[]
  unmet: string[]
  /** Titles of findings the person chose to leave as they are. */
  accepted?: string[]
}

const cm = (mm: number) => `${roundTo(mm / 10, 1)} cm`
const listed = (names: string[]) => (names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} y ${names.length - 3} más`)

const check = (c: Omit<Check, 'pieces' | 'request' | 'impossible'> & Partial<Check>): Check => ({ pieces: [], request: null, impossible: false, ...c })

/** The input with what the analysis found spelled out. */
interface Review extends ViabilityInput {
  errors: DesignError[]
  findings: Finding[]
}
const errorsFor = ({ errors }: Review, id: CheckId) => errors.filter((e) => checkOfError(e) === id)
const pieceIds = (e: DesignError) => [e.data?.piece, e.data?.a, e.data?.b].filter((x): x is string => typeof x === 'string')

/** Whether the pieces add up to the measures is analyze()'s E_OVERALL_SIZE, with its tolerance; here it is only told. */
function measures(r: Review): Check {
  const { design, analysis } = r
  const around = bounds(analysis.geo.boxes.values())
  const real = { width: around.x1 - around.x0, height: around.y1 - around.y0, depth: around.z1 - around.z0 }
  const { width, height, depth } = design.dimensions
  const wrong = new Set(errorsFor(r, 'measures').map((e) => DIMENSION_OF_AXIS[e.data?.axis as Axis]))
  const off = (['height', 'width', 'depth'] as const).filter((k) => wrong.has(k))
  if (!off.length) return check({ id: 'measures', title: 'Las medidas cierran', status: 'ok', detail: `Las piezas suman exacto ${height} × ${width} × ${depth} mm (alto, ancho, fondo).` })
  return check({
    id: 'measures',
    title: 'Las medidas no cierran',
    status: 'fail',
    impossible: true,
    detail: `Las piezas suman ${roundTo(real.height)} × ${roundTo(real.width)} × ${roundTo(real.depth)} mm y el mueble dice ${height} × ${width} × ${depth} mm; no coincide el ${off.map((k) => DIMENSION_LABEL[k]).join(' ni el ')}.`,
    request: `Haz que las piezas cierren exacto en ${height} × ${width} × ${depth} mm`,
  })
}

/** What does not fit a sheet with the person's cutting settings (the layout), and what analyze() already found too big: each piece once. */
function sheet(r: Review): Check {
  const { design, catalog, purchase } = r
  const trim = catalog.layout.trim
  const unplaced = purchase.layout.flatMap((a) => a.unplaced.map((p) => ({ id: p.id, name: p.name, length: p.length, width: p.width, usable: a.usable })))
  for (const e of errorsFor(r, 'sheet')) {
    const piece = design.pieces.find((p) => p.id === e.data?.piece)
    if (piece && !unplaced.some((u) => u.id === piece.id))
      unplaced.push({ id: piece.id, name: piece.name, length: Number(e.data?.length), width: Number(e.data?.width), usable: e.data?.sheet as { length: number; width: number } })
  }
  if (!unplaced.length) {
    const usable = purchase.layout[0]?.usable
    return check({
      id: 'sheet',
      title: 'Todo cabe en la hoja',
      status: 'ok',
      detail: usable ? `Cada pieza cabe en la parte buena de la hoja (${usable.length} × ${usable.width} mm), ya sin los ${trim} mm por orilla que se recortan.` : 'No hay piezas de triplay que acomodar.',
    })
  }
  const p = unplaced[0]
  return check({
    id: 'sheet',
    title: 'Hay piezas más grandes que la hoja',
    status: 'fail',
    impossible: true,
    pieces: unplaced.map((x) => x.id),
    detail: `${listed(unplaced.map((x) => x.name))}: ${p.name.toLowerCase()} mide ${roundTo(p.length)} × ${roundTo(p.width)} mm y lo más que sale de una hoja es ${p.usable.length} × ${p.usable.width} mm (se recortan ${trim} mm por orilla).`,
    request: `Haz que ${p.name.toLowerCase()} quepa en una hoja: máximo ${p.usable.length} × ${p.usable.width} mm`,
  })
}

function strips({ design, analysis }: Review): Check {
  const narrow = design.pieces.filter((p) => {
    const box = analysis.geo.boxes.get(p.id)
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

function structure(r: Review): Check {
  const { analysis, findings, unmet } = r
  const broken = errorsFor(r, 'structure')
  const critical = findings.filter((h) => h.severity === 'critical')
  const recommended = findings.filter((h) => h.severity === 'recommendation')
  const count = broken.length + critical.length + unmet.length
  if (count) {
    const messages = [...broken.map((e) => e.message), ...unmet, ...critical.map((h) => h.message)]
    const first = critical[0]?.alternatives[0]
    return check({
      id: 'structure',
      title: count === 1 ? 'Un problema de estructura' : `${count} problemas de estructura`,
      status: 'fail',
      impossible: broken.length > 0,
      pieces: [...new Set([...broken.flatMap(pieceIds), ...critical.flatMap((h) => h.pieces)])],
      detail: messages.slice(0, 3).join(' '),
      request: first ? first.description : null,
    })
  }
  // analyze() runs the structural rules only on a valid design: without them nothing can be said to hold.
  if (!analysis.valid)
    return check({ id: 'structure', title: 'Estructura sin revisar', status: 'warning', detail: 'La revisión estructural se hace cuando las medidas cierran y cada pieza cabe en la hoja: corrige eso primero.' })
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

function confirmed({ design }: Review): Check {
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

function margin({ catalog, purchase }: Review): Check {
  const tight = purchase.layout.flatMap((a) => {
    const sheets = a.sheets.length
    if (!sheets) return []
    const used = a.sheets.reduce((s, h) => s + h.placed.reduce((t, c) => t + c.w * c.h, 0), 0) / (sheets * a.usable.length * a.usable.width)
    const material = catalog.materials.find((m) => m.id === a.material)
    return used >= TIGHT_YIELD ? [{ name: material?.name ?? a.material, used }] : []
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
  return titles.length ? [check({ id: 'accepted', title: 'Aceptado por ti', status: 'warning', detail: `Lo dejaste así, bajo tu riesgo: ${titles.join(', ')}.` })] : []
}

/** The arithmetic checks, the most serious first. */
export function reviewViability(input: ViabilityInput): Viability {
  const { analysis } = input
  const review: Review = { ...input, errors: analysis.valid ? [] : analysis.errors, findings: input.findings ?? (analysis.valid ? analysis.findings : []) }
  const checks = [...[measures, sheet, structure, strips, confirmed, margin].map((f) => f(review)), ...acceptedByPerson(input)]
  return { verdict: verdictOf(checks), checks: checks }
}

export function verdictOf(checks: Check[]): Verdict {
  const failed = checks.filter((c) => c.status === 'fail')
  return failed.some((c) => c.impossible) ? 'not-viable' : failed.length ? 'needs-changes' : 'viable'
}

const SEVERITY: Record<Verdict, number> = { viable: 0, 'needs-changes': 1, 'not-viable': 2 }
/** The carpenter may be stricter than the arithmetic, never more lenient. */
export const worst = (a: Verdict, b: Verdict): Verdict => (SEVERITY[a] >= SEVERITY[b] ? a : b)
