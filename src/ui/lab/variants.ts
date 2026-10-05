import type { Bench, ModuleCheck } from '../../application/bench/bench'
import { analyze } from '../../domain/checks/analysis'
import { resolveGeometry, type Box } from '../../domain/design/resolve'
import { exampleDesign } from '../../domain/furniture/examples'
import type { Reference, ROOMS } from '../../domain/furniture/references'
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

export type Room = (typeof ROOMS)[number]

export const ROOM_LABELS: [Room, string][] = [
  ['bedroom', 'Recámara'],
  ['living', 'Sala'],
  ['dining', 'Comedor'],
  ['office', 'Oficina'],
  ['kitchen', 'Cocina'],
  ['entry', 'Entrada'],
  ['workshop', 'Taller'],
]

export interface FichaQuery {
  room: Room | 'all'
  /** Words of its code or name, in any case, with or without accents or dashes: «lib14», «KC-LIB-14», «escritorio». */
  text: string
}

export const ANY_FICHA: FichaQuery = { room: 'all', text: '' }

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const searchable = ({ code, name }: Pick<Reference, 'code' | 'name'>) => `${plain(code)} ${plain(code).replace(/-/g, '')} ${plain(name)}`

/** Whether a ficha's code or name has every word of a search. */
export function matchesText(reference: Pick<Reference, 'code' | 'name'>, text: string) {
  return plain(text).split(/\s+/).filter(Boolean).every((w) => searchable(reference).includes(w))
}

export function fichasOf(rows: readonly FichaRow[], q: FichaQuery): FichaRow[] {
  return rows.filter(({ reference: r }) => (q.room === 'all' || r.rooms.includes(q.room)) && matchesText(r, q.text))
}
