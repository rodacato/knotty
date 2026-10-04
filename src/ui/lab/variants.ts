import type { Bench, ModuleCheck } from '../../application/bench/bench'
import { analyze } from '../../domain/checks/analysis'
import { resolveGeometry, type Box } from '../../domain/design/resolve'
import { exampleDesign } from '../../domain/furniture/examples'
import type { Reference } from '../../domain/furniture/references'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Catalog } from '../../domain/materials/catalog'

// The bench drawer's list: every variant of every module, with what Knotty finds in it.

export type Verdict = 'ok' | 'note' | 'invalid'

export interface VariantRow {
  variant: string
  plan: FurniturePlan
  verdict: Verdict
  /** Errors when invalid, otherwise findings and then geometry warnings. */
  notes: string[]
}

export interface ModuleGroup {
  module: ModuleCheck['module']
  variants: VariantRow[]
}

const verdictOf = (c: ModuleCheck): Verdict => (!c.valid ? 'invalid' : c.findings.length || c.warnings.length ? 'note' : 'ok')

export function groupVariants(bench: Pick<Bench, 'variants' | 'runModules'>): ModuleGroup[] {
  const checks = new Map(bench.runModules().map((c) => [`${c.module}/${c.variant}`, c]))
  const groups = new Map<ModuleGroup['module'], VariantRow[]>()
  for (const { module, variant, plan } of bench.variants()) {
    const check = checks.get(`${module}/${variant}`)
    if (!check) continue
    const row: VariantRow = { variant, plan, verdict: verdictOf(check), notes: [...check.findings, ...check.warnings] }
    groups.set(module, [...(groups.get(module) ?? []), row])
  }
  return [...groups].map(([module, variants]) => ({ module, variants }))
}

export interface FichaRow {
  reference: Reference
  verdict: Verdict
  notes: string[]
  /** What the thumbnail draws; null when the plan does not resolve. */
  boxes: Map<string, Box> | null
}

/** Every ficha Knotty ships, built and checked as `probe` does: with its kind, so the use notices (R10) count too. */
export function listFichas(references: readonly Reference[], catalog: Catalog): FichaRow[] {
  return references.map((reference) => {
    const { design } = exampleDesign({ name: reference.name, plan: reference.plan, notes: reference.notes, kind: reference.kind, finish: reference.finish }, catalog)
    const geo = resolveGeometry(design, catalog)
    const boxes = geo.ok ? geo.value.boxes : null
    const a = analyze(design, catalog)
    if (!a.valid) return { reference, verdict: 'invalid', notes: a.errors.map((e) => e.message), boxes }
    const notes = [...a.findings.map((f) => f.message), ...a.warnings.map((w) => w.message)]
    return { reference, verdict: notes.length ? 'note' : 'ok', notes, boxes }
  })
}

export type Room = 'bedroom' | 'living' | 'dining' | 'office' | 'kitchen' | 'entry'

export const ROOMS: [Room, string][] = [
  ['bedroom', 'Recámara'],
  ['living', 'Sala'],
  ['dining', 'Comedor'],
  ['office', 'Oficina'],
  ['kitchen', 'Cocina'],
  ['entry', 'Entrada'],
]

/** Where a piece goes, by the family in its code (KC-APA-01 is an APA); a piece can go in more than one room. */
const ROOMS_OF_FAMILY: Record<string, Room[]> = {
  CAM: ['bedroom'],
  BUR: ['bedroom'],
  CAJ: ['bedroom'],
  TV: ['living'],
  CON: ['living'],
  MCE: ['living'],
  REP: ['living'],
  LIB: ['living', 'office'],
  APA: ['living', 'dining'],
  MES: ['dining'],
  ASI: ['dining'],
  ESC: ['office'],
  COC: ['kitchen'],
}

/** OTR holds whatever fits no family, so each one says its own room. */
const ROOMS_OF_CODE: Record<string, Room[]> = {
  'KC-OTR-02': ['kitchen', 'living'],
  'GN-OTR-01': ['entry'],
  'KC-OTR-03': ['entry'],
  'KC-OTR-04': ['entry', 'living'],
  'KC-ASI-02': ['dining', 'kitchen'],
}

export const roomsOf = ({ code }: Pick<Reference, 'code'>): Room[] => ROOMS_OF_CODE[code] ?? ROOMS_OF_FAMILY[code.split('-')[1]] ?? []

export interface FichaQuery {
  room: Room | 'all'
  onHome: boolean
  withFindings: boolean
  source: 'all' | 'KC' | 'GN'
}

export const ANY_FICHA: FichaQuery = { room: 'all', onHome: false, withFindings: false, source: 'all' }

export function fichasOf(rows: readonly FichaRow[], q: FichaQuery): FichaRow[] {
  return rows.filter(
    ({ reference: r, verdict }) =>
      (q.room === 'all' || roomsOf(r).includes(q.room)) && (!q.onHome || !!r.home) && (!q.withFindings || verdict !== 'ok') && (q.source === 'all' || r.code.startsWith(`${q.source}-`)),
  )
}
