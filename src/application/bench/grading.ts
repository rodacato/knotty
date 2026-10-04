import { designParts } from '../../domain/editing/intent/counts'
import { analyze } from '../../domain/checks/analysis'
import { findingKey } from '../../domain/checks/structure/finding'
import { estimatePurchase } from '../../domain/materials/purchase'
import { reviewViability } from '../../domain/checks/viability/viability'
import type { Design, Dimensions } from '../../domain/design/schema'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Catalog } from '../../domain/materials/catalog'
import { currentDesign, currentVersion, type DesignState } from '../../domain/session/state'
import type { AfterRequest, BenchCase, Expect, Outcome, Part, Range } from './cases'

// Grades the real state after every step of a case: what the person would have in front of them, with a pending proposal kept apart from the current design.
// Pure: it runs no expert, so the same states always get the same grades.

/** Bump it on purpose whenever a change here can turn a result from one verdict to another. */
export const GRADER_VERSION = '2'

const DEFAULT_OUTCOMES: Outcome[] = ['applied', 'pending', 'answer']
const DEFAULT_VERDICTS = ['viable']
const DIMENSIONS = ['height', 'width', 'depth'] as const

export interface DesignGrade {
  valid: boolean
  /** The review's verdict, or `invalid` when the design does not even resolve. */
  verdict: string
  criticals: number
  rules: string[]
  criticalKeys: string[]
  /** Why an invalid design is invalid, first three. */
  problems: string[]
  pieces: number
  joints: number
  /** Height × width × depth, in mm. */
  measures: string
  counts: Record<Part, number | null>
}

export interface ExpectationResult {
  id: string
  kind: Expect['kind']
  status: 'pass' | 'fail' | 'unknown'
  detail: string
  mandatory: boolean
  /** Which one was examined: a pending proposal is judged on its own design, never on the current one. */
  subject: 'design' | 'proposal'
  unsupported?: string
}

export interface StepResult {
  step: number
  label: string
  request: string | null
  outcome: Outcome
  design: DesignGrade
  proposal: DesignGrade | null
  expectations: ExpectationResult[]
}

export interface StepSpec {
  label: string
  /** Null for the first step, which reconstructs from the case's notes. */
  request: string | null
  /** Everything that must hold after the step, the carried expectations included. */
  expect: Expect[]
}

export interface Scenario {
  caseId: string
  steps: StepSpec[]
}

/** Doors and drawers by their pieces; open openings from the cells of a cabinet's plan. */
export function countParts(design: Design, plan: FurniturePlan | null): Record<Part, number | null> {
  const open = plan?.kind === 'cabinet' ? plan.columns.flatMap((c) => c.cells).filter((c) => c.content === 'open').length : null
  return { ...designParts(design), open }
}

const keyOf = (e: Expect): string => {
  switch (e.kind) {
    case 'dimensions':
    case 'origin':
    case 'noNewCritical':
    case 'verdict':
    case 'outcome':
      return e.kind
    case 'parts':
      return `parts:${e.part}`
    case 'pieces':
      return `pieces:${e.roles.join('+')}${e.idPrefix ? `:${e.idPrefix}` : ''}${e.support ? `:${e.support}` : ''}`
    case 'planField':
      return `planField:${e.field}`
    case 'placement':
      return `placement:${e.role}`
    case 'preserved':
      return `preserved:${e.dimension}`
    case 'requirement':
      return `requirement:${e.id ?? e.type}`
    case 'declared':
      return `declared:${e.what}`
  }
}

/** What a later step inherits unless it says otherwise: the shape of the furniture, not how the design came to be. */
const CARRIED = new Set<Expect['kind']>(['dimensions', 'parts', 'pieces', 'planField', 'placement', 'requirement'])

/** The case as explicit steps: the reconstruction, then one step per request, each with the expectations it must meet. */
export function scenarioOf(c: BenchCase): Scenario {
  const carried = new Map<string, Expect>()
  const carry = (specs: Expect[]) => specs.filter((e) => CARRIED.has(e.kind)).forEach((e) => carried.set(keyOf(e), e))

  const first: Expect[] = [
    { kind: 'dimensions', ranges: c.expected, anyOrientation: c.anyOrientation },
    ...(c.path || c.module ? [{ kind: 'origin' as const, path: c.path, module: c.module }] : []),
    ...(Object.entries(c.parts ?? {}) as [Part, number][]).map(([part, count]): Expect => ({ kind: 'parts', part, count })),
    ...(c.expect ?? []),
  ]
  carry(first)
  const steps: StepSpec[] = [
    { label: 'diseño inicial', request: null, expect: [{ kind: 'outcome', allowed: ['applied'] }, { kind: 'verdict', allowed: DEFAULT_VERDICTS }, ...first] },
  ]

  for (const request of c.adjust ?? []) {
    const after: AfterRequest = c.afterRequest?.[request] ?? {}
    const own = after.expect ?? []
    carry(own)
    const kept = own.filter((e) => !CARRIED.has(e.kind))
    const verdict = kept.find((e) => e.kind === 'verdict') ?? { kind: 'verdict' as const, allowed: DEFAULT_VERDICTS }
    const outcome = { kind: 'outcome' as const, allowed: after.outcomes ?? DEFAULT_OUTCOMES }
    const changing = new Set(after.changes ?? [])
    steps.push({
      label: `«${request}»`,
      request,
      expect: [
        outcome,
        verdict,
        { kind: 'noNewCritical' },
        ...DIMENSIONS.filter((d) => !changing.has(d)).map((dimension): Expect => ({ kind: 'preserved', dimension })),
        ...carried.values(),
        ...kept.filter((e) => e.kind !== 'verdict'),
      ],
    })
  }
  return { caseId: c.id, steps }
}

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : value

/** The case as canonical JSON, keys sorted: the same case always gives the same text, to hash wherever it is needed. */
export const caseFingerprint = (c: BenchCase) => JSON.stringify(canonical(c))

function gradeDesign(design: Design, state: Pick<DesignState, 'requirements'>, plan: FurniturePlan | null, catalog: Catalog): DesignGrade {
  const base = { pieces: design.pieces.length, joints: design.joints.length, measures: `${design.dimensions.height} × ${design.dimensions.width} × ${design.dimensions.depth}`, counts: countParts(design, plan) }
  const a = analyze(design, catalog, state.requirements)
  if (!a.valid) return { ...base, valid: false, verdict: 'invalid', criticals: 0, rules: [], criticalKeys: [], problems: a.errors.slice(0, 3).map((e) => e.message) }
  const purchase = estimatePurchase(design, a.geo, catalog)
  const viability = reviewViability({ design, analysis: a, catalog, purchase, unmet: [] })
  const criticals = a.findings.filter((h) => h.severity === 'critical')
  return { ...base, valid: true, verdict: viability.verdict, criticals: criticals.length, rules: [...new Set(criticals.map((h) => h.code))], criticalKeys: criticals.map(findingKey), problems: [] }
}

/** What a request did, from the session and not from what the expert says it did. */
export function outcomeOf(before: DesignState, after: DesignState): Outcome {
  const last = after.chat.at(-1)
  if (last?.error) return last.failure === 'rejection' ? 'rejected' : 'error'
  if (after.proposal && after.proposal !== before.proposal) return 'pending'
  if (after.current !== before.current) return 'applied'
  return 'answer'
}

const inRange = (n: number, count: number | Range) => (typeof count === 'number' ? n === count : n >= count[0] && n <= count[1])
const said = (count: number | Range) => (typeof count === 'number' ? `${count}` : `${count[0]} a ${count[1]}`)
const approx = (a: number, b: number) => Math.abs(a - b) <= 0.5

type Verdict = Pick<ExpectationResult, 'status' | 'detail'>
const pass = (detail: string): Verdict => ({ status: 'pass', detail })
const fail = (detail: string): Verdict => ({ status: 'fail', detail })
const unknown = (detail: string): Verdict => ({ status: 'unknown', detail })
const verdictOn = (ok: boolean, detail: string) => (ok ? pass(detail) : fail(detail))

const valueAt = (plan: FurniturePlan, field: string): unknown => field.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), plan)

interface Context {
  catalog: Catalog
  before: DesignState | null
  after: DesignState
  outcome: Outcome
  grade: DesignGrade
  previous: DesignGrade | null
  design: Design
  plan: FurniturePlan | null
}

function evaluate(e: Expect, x: Context): Verdict {
  switch (e.kind) {
    case 'dimensions': {
      const inside = (d: Dimensions) => Object.entries(e.ranges).every(([k, [min, max]]) => d[k as keyof Dimensions] >= min && d[k as keyof Dimensions] <= max)
      const d = x.design.dimensions
      const ok = inside(d) || (!!e.anyOrientation && inside({ ...d, width: d.depth, depth: d.width }))
      return verdictOn(ok, ok ? `medidas ${x.grade.measures}` : `medidas ${x.grade.measures} fuera de lo esperado`)
    }
    case 'origin': {
      const path = x.plan ? 'plan' : 'pieces'
      const wrongPath = e.path && e.path !== path
      const wrongModule = e.module && x.plan?.kind !== e.module
      return verdictOn(!wrongPath && !wrongModule, wrongPath ? `salió ${path === 'plan' ? 'por ficha' : 'pieza por pieza'}` : wrongModule ? `la ficha es ${x.plan?.kind ?? 'ninguna'}, no ${e.module}` : 'camino y módulo como se pidió')
    }
    case 'parts': {
      const found = x.grade.counts[e.part]
      if (found === null) return unknown(`no se pueden contar los huecos abiertos fuera de la ficha del gabinete`)
      return verdictOn(inRange(found, e.count), `${PART_LABEL[e.part]} ${found} (pidió ${said(e.count)})`)
    }
    case 'pieces': {
      if (e.idPrefix && !x.plan) return unknown(`las piezas «${e.idPrefix}…» solo las nombra una ficha`)
      const found = x.design.pieces.filter((p) => e.roles.includes(p.role) && (!e.idPrefix || p.id.startsWith(e.idPrefix)) && (!e.support || p.support === e.support)).length
      return verdictOn(inRange(found, e.count), `${e.roles.join('+')}${e.support ? ` ${e.support}` : ''} ${found} (pidió ${said(e.count)})`)
    }
    case 'planField': {
      if (!x.plan) return unknown(`el diseño no viene de una ficha: no se puede leer «${e.field}»`)
      const value = valueAt(x.plan, e.field)
      if (value === undefined) return fail(`la ficha ${x.plan.kind} no tiene «${e.field}»`)
      return verdictOn(e.allowed.includes(value as never), `${e.field} es ${String(value)} (pidió ${e.allowed.join(' o ')})`)
    }
    case 'placement': {
      const geo = analyze(x.design, x.catalog, x.after.requirements).geo
      if (!geo) return unknown('el diseño no se pudo medir')
      const boxes = [...geo.boxes.values()]
      const mid = (Math.min(...boxes.map((b) => b.y0)) + Math.max(...boxes.map((b) => b.y1))) / 2
      const centers = x.design.pieces.filter((p) => p.role === e.role).flatMap((p) => geo.boxes.get(p.id) ?? []).map((b) => (b.y0 + b.y1) / 2)
      if (!centers.length) return fail(`no hay piezas ${e.role}`)
      const ok = centers.every((y) => (e.half === 'upper' ? y > mid : y < mid))
      return verdictOn(ok, `${e.role} en la mitad ${e.half === 'upper' ? 'de arriba' : 'de abajo'}: ${ok ? 'sí' : 'no'}`)
    }
    case 'preserved': {
      if (!x.before) return unknown('no hay paso anterior con qué comparar')
      const was = currentDesign(x.before).dimensions[e.dimension]
      const now = x.design.dimensions[e.dimension]
      return verdictOn(approx(was, now), approx(was, now) ? `${DIMENSION_LABEL[e.dimension]} sigue en ${now}` : `${DIMENSION_LABEL[e.dimension]} pasó de ${was} a ${now} sin pedirlo`)
    }
    case 'requirement': {
      const has = x.after.requirements.some((r) => (e.id ? r.id === e.id : r.type === e.type))
      const had = x.before?.requirements.some((r) => (e.id ? r.id === e.id : r.type === e.type))
      return verdictOn(has, has ? `se mantiene ${e.id ?? e.type}` : had ? `se perdió ${e.id ?? e.type}` : `nunca estuvo ${e.id ?? e.type}`)
    }
    case 'noNewCritical': {
      if (!x.previous) return unknown('no hay paso anterior con qué comparar')
      const added = x.grade.criticalKeys.filter((k) => !x.previous!.criticalKeys.includes(k))
      return verdictOn(!added.length, added.length ? `críticos nuevos sin que nadie los aceptara: ${added.join(' ')}` : 'sin críticos nuevos')
    }
    case 'verdict':
      return verdictOn(e.allowed.includes(x.grade.verdict), `veredicto ${x.grade.verdict}${e.allowed.includes(x.grade.verdict) ? '' : ` (esperado ${e.allowed.join(' o ')})`}`)
    case 'outcome':
      return verdictOn(e.allowed.includes(x.outcome), `resultado ${x.outcome}${e.allowed.includes(x.outcome) ? '' : ` (esperado ${e.allowed.join(' o ')})`}`)
    case 'declared':
      return unknown(e.what)
  }
}

const PART_LABEL: Record<Part, string> = { doors: 'puertas', drawers: 'cajones', open: 'abiertos' }
const DIMENSION_LABEL: Record<keyof Dimensions, string> = { height: 'el alto', width: 'el ancho', depth: 'el fondo' }

/** Content checks follow a pending proposal; whether the design as it stands is viable and free of new criticals is always about the design. */
const ABOUT_DESIGN = new Set<Expect['kind']>(['outcome', 'verdict', 'noNewCritical', 'requirement'])

/** Grades the state a step left: the current design and any proposal apart, and every expectation of the step on the one it is about. */
export function gradeStep(p: { catalog: Catalog; spec: StepSpec; index: number; before: DesignState | null; after: DesignState; outcome: Outcome; previous: StepResult | null }): StepResult {
  const { catalog, spec, before, after, outcome } = p
  const version = currentVersion(after)
  const design = gradeDesign(version.design, after, version.plan, catalog)
  const proposal = after.proposal ? gradeDesign(after.proposal.design, after.proposal, after.proposal.plan, catalog) : null
  const onProposal = outcome === 'pending' && !!after.proposal
  const expectations = spec.expect.map((e): ExpectationResult => {
    const subjectIsProposal = onProposal && !ABOUT_DESIGN.has(e.kind)
    const context: Context = subjectIsProposal
      ? { catalog, before, after, outcome, grade: proposal!, previous: p.previous?.design ?? null, design: after.proposal!.design, plan: after.proposal!.plan }
      : { catalog, before, after, outcome, grade: design, previous: p.previous?.design ?? null, design: version.design, plan: version.plan }
    const id = `${p.index}:${keyOf(e)}`
    const subject = subjectIsProposal ? ('proposal' as const) : ('design' as const)
    if (e.unsupported) return { id, kind: e.kind, status: 'unknown', detail: e.unsupported, mandatory: false, subject, unsupported: e.unsupported }
    return { id, kind: e.kind, mandatory: e.mandatory ?? true, subject, ...evaluate(e, context) }
  })
  return { step: p.index, label: spec.label, request: spec.request, outcome, design, proposal, expectations }
}

/** Whether the final design is within the case's measures and the first one came the way the case asked. */
export function reasonableOf(steps: StepResult[]): boolean | null {
  const first = steps[0]
  const last = steps.at(-1)
  if (!first || !last) return null
  const measures = last.expectations.find((e) => e.kind === 'dimensions')
  const origin = first.expectations.find((e) => e.kind === 'origin')
  return measures?.status === 'pass' && (!origin || origin.status === 'pass')
}
