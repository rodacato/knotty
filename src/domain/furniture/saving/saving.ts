import type { Design } from '../../design/schema'
import { faceSize, resolveGeometry } from '../../design/resolve'
import { analyze } from '../../checks/analysis'
import { findingKey } from '../../checks/structure/finding'
import type { Requirement } from '../../checks/requirements/requirements'
import { boardsFor, materialById, usableSheet, type Catalog } from '../../materials/catalog'
import { layOut } from '../../estimate/layout'
import type { Operation } from '../../editing/operations/schema'
import { valueFields, type ChoiceField, type MaterialField, type NumberField, type StepperField, type ValueField } from '../modules/fields'
import { FurniturePlan, moduleOf } from '../modules/plan'
import { rebuildFromPlan } from '../modules/rebuild'

// «Ahorrar material»: other values for the fields the person left free, kept only when the same layout as Materiales needs fewer sheets
// and the design holds as well as before. The rules are docs/carpinteria/fabricacion-y-armado.md §2.5, «Qué puede proponer la app».

/** Builds the search may run, probes included, so it stays well under a second on a phone. */
const MAX_EVALUATIONS = 60
/** And, when nothing saves, builds to find which lock is worth freeing. */
const MAX_RELEASE_EVALUATIONS = 24
/** A measure goes down at most this fraction of itself: past it the piece is another piece. */
const MAX_REDUCTION = 0.25
/** Strip counts tried across and along the sheet. */
const MAX_STRIPS = 12
/** Measures tried per number field, the closest to the current one first. */
const VALUES_PER_NUMBER = 4
/** How far a measure moves to see which piece sizes follow it. */
const PROBE = 10

export type LockOverrides = Record<string, boolean>
type Plan = FurniturePlan
type Field = ChoiceField<Plan> | MaterialField<Plan> | StepperField<Plan> | NumberField<Plan>
const lockable = (field: ValueField<Plan>): field is Field => field.type !== 'custom'

export interface SheetCount {
  material: string
  thickness: number
  sheets: number
}

export interface Saving {
  title: string
  /** What changes, gains and losses, in words for the person. */
  changes: string[]
  /** Sheets fewer than today, over every material. */
  saved: number
  plan: Plan
  design: Design
  sheets: SheetCount[]
}

/** A locked field that, freed, would save sheets. */
export interface Release {
  key: string
  label: string
  change: string
  saved: number
}

export interface SavingSearch {
  today: SheetCount[]
  /** Names of the locked fields in sight, for «Sin tocar …». */
  locked: string[]
  options: Saving[]
  /** Filled only when there is no option. */
  releases: Release[]
}

/** The fields a lock applies to: every one with a value in sight, but those drawn by a component of their own. */
export const lockableFields = (plan: Plan): Field[] => valueFields(moduleOf(plan).fields, plan).filter(lockable)

export const isLocked = (field: { key: string; lockedByDefault?: boolean }, overrides: LockOverrides) => overrides[field.key] ?? field.lockedByDefault ?? false

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const lowered = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
const nameOf = (field: Field) => field.ariaLabel ?? field.label
const isYesNo = (field: Field) => field.type === 'choice' && field.options.length === 2 && field.options[0][0] === 'yes' && field.options[1][0] === 'no'

function optionText(field: Field, value: string | number, catalog: Catalog) {
  if (field.type === 'choice') return field.options.find(([v]) => v === value)?.[1] ?? String(value)
  if (field.type === 'material') return `${materialById(catalog, String(value))?.thickness ?? value} mm`
  return String(value)
}

/** One change in words: «Cajones por lado de 3 a 2», «Fondo de 300 a 292 mm», «Sin repisa baja». */
function changeLine(field: Field, before: string | number, after: string | number, catalog: Catalog) {
  if (isYesNo(field)) return `${after === 'yes' ? 'Con' : 'Sin'} ${lowered(nameOf(field))}`
  const unit = field.type === 'number' ? ' mm' : ''
  return `${capitalized(nameOf(field))} de ${optionText(field, before, catalog)} a ${optionText(field, after, catalog)}${unit}`
}

function titleOf(field: Field, after: string | number, catalog: Catalog) {
  if (field.type === 'number' || field.type === 'stepper') return `Menos ${lowered(nameOf(field))}`
  if (isYesNo(field)) return changeLine(field, '', after, catalog)
  return `${capitalized(nameOf(field))}: ${lowered(optionText(field, after, catalog))}`
}

/** The widest a piece can be to get `n` strips out of `usable` (§2.5): `(usable − kerf·(n−1)) / n − play`, rounded down. */
const stripWidths = (usable: number, kerf: number, play: number) => Array.from({ length: MAX_STRIPS }, (_, i) => Math.floor((usable - kerf * i) / (i + 1) - play))

interface Built {
  design: Design
  sheets: SheetCount[]
  total: number
  criticals: Set<string>
  notes: string[]
  dropped: number
  hasBack: boolean
  slides: number[]
}

interface Change {
  field: Field
  value: string | number
}

interface Context {
  catalog: Catalog
  extras: Operation[]
  requirements: Requirement[]
}

export interface SavingInput extends Context {
  overrides: LockOverrides
}

/** The drawer slides' lengths, longest first: a shorter slide is a loss worth saying. */
function slideLengths(design: Design, catalog: Catalog) {
  const ids = design.joints.filter((j) => j.type === 'drawer-slide').flatMap((j) => j.hardware.map((h) => h.hardwareId))
  const lengths = ids.map((id) => catalog.hardware.find((h) => h.id === id)?.length).filter((l): l is number => typeof l === 'number')
  return [...new Set(lengths)].sort((a, b) => b - a)
}

/** The plan as Aplicar would build it, with the extras on top, and the sheets the Materiales layout needs for it. */
function evaluate(plan: Plan, { catalog, extras, requirements }: Context): Built | null {
  const parsed = FurniturePlan.safeParse(plan)
  if (!parsed.success) return null
  const rebuilt = rebuildFromPlan(parsed.data, extras, catalog, requirements)
  const analysis = analyze(rebuilt.design, catalog, requirements)
  if (!analysis.valid) return null
  const sheets = layOut(rebuilt.design, analysis.geo, catalog).map((l) => ({ material: l.material, thickness: materialById(catalog, l.material)?.thickness ?? 0, sheets: l.sheets.length + l.unplaced.length }))
  sheets.sort((a, b) => b.thickness - a.thickness)
  return {
    design: rebuilt.design,
    sheets,
    total: sheets.reduce((s, m) => s + m.sheets, 0),
    criticals: new Set(analysis.findings.filter((f) => f.severity === 'critical').map(findingKey)),
    notes: rebuilt.notes,
    dropped: rebuilt.dropped.length,
    hasBack: rebuilt.design.pieces.some((p) => p.role === 'back'),
    slides: slideLengths(rebuilt.design, catalog),
  }
}

/** Fewer sheets and no more of any, nothing new to buy (rule 7), no new critical finding (rules 5, 6, 9), no drawer or expert change lost, the back kept (rule 8). */
function saves(today: Built, candidate: Built) {
  const before = new Map(today.sheets.map((m) => [m.material, m.sheets]))
  return (
    candidate.total < today.total &&
    candidate.sheets.every((m) => before.has(m.material) && m.sheets <= before.get(m.material)!) &&
    [...candidate.criticals].every((k) => today.criticals.has(k)) &&
    candidate.notes.every((n) => today.notes.includes(n)) &&
    candidate.dropped === 0 &&
    (!today.hasBack || candidate.hasBack)
  )
}

/** Every piece's two face sizes, to see which ones follow a measure. */
function faceSizes(plan: Plan, catalog: Catalog) {
  const design = moduleOf(plan).build(plan, catalog).design
  const geo = resolveGeometry(design, catalog)
  const sizes = new Map<string, number>()
  if (!geo.ok) return sizes
  for (const p of design.pieces) {
    const box = geo.value.boxes.get(p.id)
    if (box) faceSize(box, p.normal).forEach((size, i) => sizes.set(`${p.material}|${p.id}|${i}`, size))
  }
  return sizes
}

/** The values worth trying for one field, closest to the current one first; a measure's probe is paid from `budget`. */
function candidateValues(field: Field, plan: Plan, catalog: Catalog, budget: { left: number }): (string | number)[] {
  switch (field.type) {
    case 'choice':
      return field.options.map(([v]) => v).filter((v) => v !== field.get(plan))
    case 'material':
      return boardsFor(catalog, field.use)
        .map((m) => m.id)
        .filter((id) => id !== field.get(plan))
    case 'stepper': {
      const current = field.get(plan)
      return Array.from({ length: Math.max(0, current - field.min) }, (_, i) => current - 1 - i)
    }
    case 'number': {
      // Each piece size that follows the measure gives the measure that brings it down to the widest piece for one strip less (rule 3).
      if (budget.left <= 0) return []
      budget.left--
      const current = field.get(plan)
      const before = faceSizes(plan, catalog)
      const after = faceSizes(field.set(plan, current - PROBE), catalog)
      const { kerf, clearance } = catalog.layout
      const values = new Set<number>()
      for (const [key, size] of before) {
        const slope = (size - (after.get(key) ?? size)) / PROBE
        const material = materialById(catalog, key.split('|')[0])
        if (slope <= 0 || !material) continue
        const usable = usableSheet(catalog, material)
        for (const width of [...stripWidths(usable.width, kerf, clearance), ...stripWidths(usable.length, kerf, clearance)]) {
          if (width >= size) continue
          const value = Math.floor(current - (size - width) / slope)
          if (value >= (field.min ?? 1) && value >= current * (1 - MAX_REDUCTION)) values.add(value)
        }
      }
      return [...values].sort((a, b) => b - a).slice(0, VALUES_PER_NUMBER)
    }
    default:
      return []
  }
}

const applied = (plan: Plan, changes: Change[]) => changes.reduce((p, c) => (c.field.set as (plan: Plan, value: string | number) => Plan)(p, c.value), plan)

function describe(plan: Plan, changes: Change[], today: Built, built: Built, catalog: Catalog) {
  const lines = changes.map((c) => changeLine(c.field, c.field.get(plan), c.value, catalog))
  if (built.slides.length && today.slides.join() !== built.slides.join()) lines.push(`Correderas de ${today.slides.join(' y ')} a ${built.slides.join(' y ')} mm`)
  return lines
}

/** A measure or a count gives up as little as it can; a choice has no order, so it takes the one that saves the most. */
const ordered = (field: Field) => field.type === 'number' || field.type === 'stepper'
/** Smaller changes first: a few millimeters, then one thing less, then another board, then another way of building it. */
const RANK: Record<Field['type'], number> = { number: 0, stepper: 1, material: 2, choice: 3 }

/** The best value of each field alone, smallest changes first. */
function bestPerField(plan: Plan, fields: Field[], today: Built, context: Context, budget: { left: number }, keeps: (candidate: Plan) => boolean) {
  const found: { change: Change; built: Built }[] = []
  for (const field of fields) {
    let best: { change: Change; built: Built } | null = null
    for (const value of candidateValues(field, plan, context.catalog, budget)) {
      if (budget.left <= 0) break
      const candidate = applied(plan, [{ field, value }])
      if (!keeps(candidate)) continue
      budget.left--
      const built = evaluate(candidate, context)
      if (built && saves(today, built) && (!best || built.total < best.built.total)) best = { change: { field, value }, built }
      if (best && ordered(field)) break
    }
    if (best) found.push(best)
  }
  return found.sort((a, b) => RANK[a.change.field.type] - RANK[b.change.field.type] || a.built.total - b.built.total)
}

/** The ways to use fewer sheets without touching what is locked, up to three; when there is none, which locks would open one. */
export function findSavings(plan: Plan, input: SavingInput): SavingSearch {
  const { overrides, ...context } = input
  const { catalog } = context
  const today = evaluate(plan, context)
  const fields = lockableFields(plan)
  const lockedFields = fields.filter((f) => isLocked(f, overrides))
  const locked = lockedFields.map((f) => lowered(nameOf(f)))
  // Rule 2 whatever a field's `set` also moves: every locked value, in sight or not, stays as it was.
  const allLocked = valueFields(moduleOf(plan).fields).filter(lockable).filter((f) => isLocked(f, overrides))
  const keepsAllBut = (free: string | null) => (candidate: Plan) => allLocked.every((f) => f.key === free || Object.is(f.get(candidate), f.get(plan)))
  if (!today) return { today: [], locked, options: [], releases: [] }
  const budget = { left: MAX_EVALUATIONS - 1 }
  const singles = bestPerField(
    plan,
    fields.filter((f) => !isLocked(f, overrides)),
    today,
    context,
    budget,
    keepsAllBut(null),
  )
  const option = (changes: Change[], built: Built, title: string): Saving => ({ title, changes: describe(plan, changes, today, built, catalog), saved: today.total - built.total, plan: applied(plan, changes), design: built.design, sheets: built.sheets })

  // Two changes together, from the best four alone, count only when they save more than either one.
  let pair: Saving | null = null
  const top = singles.slice(0, 4)
  for (let i = 0; i < top.length; i++)
    for (let j = i + 1; j < top.length && budget.left > 0; j++) {
      budget.left--
      const changes = [top[i].change, top[j].change]
      if (!keepsAllBut(null)(applied(plan, changes))) continue
      const built = evaluate(applied(plan, changes), context)
      if (built && saves(today, built) && built.total < Math.min(top[i].built.total, top[j].built.total) && (!pair || today.total - built.total > pair.saved)) pair = option(changes, built, 'Las dos juntas')
    }
  const options = singles.map((s) => option([s.change], s.built, titleOf(s.change.field, s.change.value, catalog)))
  const chosen = pair ? [...options.slice(0, 2), pair] : options.slice(0, 3)
  if (chosen.length) return { today: today.sheets, locked, options: chosen, releases: [] }

  const releaseBudget = { left: MAX_RELEASE_EVALUATIONS }
  const releases = lockedFields
    .flatMap((field): Release[] => {
      const [best] = bestPerField(plan, [field], today, context, releaseBudget, keepsAllBut(field.key))
      return best ? [{ key: field.key, label: field.label, change: changeLine(field, field.get(plan), best.change.value, catalog), saved: today.total - best.built.total }] : []
    })
    .sort((a, b) => b.saved - a.saved)
    .slice(0, 2)
  return { today: today.sheets, locked, options: [], releases }
}
