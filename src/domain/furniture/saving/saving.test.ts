import { describe, expect, it } from 'vitest'
import { analyze } from '../../checks/analysis'
import { estimatePurchase } from '../../estimate/purchase'
import { testCatalog } from '../fixtures/catalog.test-util'
import type { BedPlan } from '../modules/bed'
import { MODULES, type FurniturePlan } from '../modules/plan'
import { rebuildFromPlan } from '../modules/rebuild'
import type { TablePlan } from '../modules/table'
import { findSavings, lockableFields, type LockOverrides } from './saving'

const search = (plan: FurniturePlan, overrides: LockOverrides = {}) => findSavings(plan, { catalog: testCatalog, extras: [], requirements: [], overrides })

/** What Materiales would say for a plan, computed on its own: total sheets and critical findings. */
function materials(plan: FurniturePlan) {
  const { design } = rebuildFromPlan(plan, [], testCatalog)
  const analysis = analyze(design, testCatalog)
  if (!analysis.valid) throw new Error('invalid design')
  const sheets = estimatePurchase(design, analysis.geo, testCatalog).sheets
  return { total: sheets.reduce((s, h) => s + h.sheets, 0), materials: sheets.map((h) => h.material.id), criticals: analysis.findings.filter((f) => f.severity === 'critical') }
}

const variant = <K extends keyof typeof MODULES>(kind: K, name: string) => MODULES[kind].benchVariants().find(([n]) => n === name)![1]
const allFree = (plan: FurniturePlan): LockOverrides => Object.fromEntries(lockableFields(plan).map((f) => [f.key, false]))
/** A fixed number of a module's variants, evenly spread: the bed's grow with every option it gains, and a search per variant would grow with them. */
const spread = <T>(all: T[], count: number) => (all.length <= count ? all : Array.from({ length: count }, (_, i) => all[Math.floor((i * all.length) / count)]))

describe('«Ahorrar material»', () => {
  const bed = variant('bed', 'queen, cabecera lisa, cajones de los dos lados hacia el pie') as BedPlan

  it('finds fewer sheets for a bed with its mattress locked, as Materiales would count them', () => {
    const r = search(bed)
    const today = materials(bed)
    expect(r.today.reduce((s, m) => s + m.sheets, 0)).toBe(today.total)
    expect(r.locked).toEqual(['colchón'])
    expect(r.options.length).toBeGreaterThan(0)
    expect(r.options.length).toBeLessThanOrEqual(3)
    for (const option of r.options) {
      expect((option.plan as BedPlan).mattress).toBe('queen')
      expect(option.changes.length).toBeGreaterThan(0)
      expect(materials(option.plan).total).toBe(today.total - option.saved)
      expect(option.saved).toBeGreaterThan(0)
    }
    expect(r.options[0]).toMatchObject({ title: 'Menos alto de la base', changes: ['Alto de la base de 400 a 361 mm'], saved: 1 })
  })

  it('never changes a locked field, nor a value a free field would move along with it', () => {
    const locked: LockOverrides = { 'drawers.count': true, height: true, 'drawers.side': false }
    for (const [, plan] of spread(MODULES.bed.benchVariants(), 16)) {
      for (const option of search(plan, locked).options) {
        const p = option.plan as BedPlan
        expect([p.mattress, p.drawers.count, p.height]).toEqual([plan.mattress, plan.drawers.count, plan.height])
      }
    }
  })

  it('with nothing to save, says which lock would open a saving', () => {
    const plain = variant('bed', 'king, respaldo y brazos de cama de día, sin cajones') as BedPlan
    const r = search(plain, { height: true, 'headboard.style': true, 'headboard.height': true, material: true })
    expect(r.options).toEqual([])
    expect(r.releases).toEqual([{ key: 'mattress', label: 'Colchón', change: 'Colchón de King a Individual', saved: 2 }])
  })

  it('offers nothing for a bookcase that already fits its sheets', () => {
    const bookcase = variant('cabinet', 'librero')
    const r = search(bookcase)
    expect(r.today).toEqual([
      { material: 'T18', thickness: 18, sheets: 1 },
      { material: 'TR6', thickness: 6, sheets: 1 },
    ])
    expect(r.options).toEqual([])
  })

  it('never offers a measure that saves a sheet at the cost of a critical finding', () => {
    const desk = variant('table', 'escritorio') as TablePlan
    const lower = { ...desk, dimensions: { ...desk.dimensions, height: 600 } }
    expect(materials(lower).total).toBeLessThan(materials(desk).total)
    expect(materials(lower).criticals.length).toBeGreaterThan(0)
    const r = search(desk, { 'dimensions.height': false, 'dimensions.depth': true, 'dimensions.width': true, overhang: true })
    expect(r.options).toEqual([])
  })

  it('never takes the back off, even when that would save a sheet', () => {
    const bookcase = variant('cabinet', 'librero')
    expect(materials({ ...bookcase, construction: { ...bookcase.construction, back: 'none' } }).total).toBeLessThan(materials(bookcase).total)
    expect(search(bookcase, allFree(bookcase)).options).toEqual([])
  })

  it('brings a depth down to the widest piece for one strip less, and says the shorter slide it costs', () => {
    const desk = variant('table', 'escritorio') as TablePlan
    expect(search(desk, { 'dimensions.depth': false }).options[0]).toMatchObject({ changes: ['Fondo de 600 a 590 mm'], saved: 1 })
    const drawers = variant('cabinet', 'cajonera')
    expect(search(drawers, { 'dimensions.depth': false }).options[0].changes).toEqual(['Fondo de 450 a 344 mm', 'Correderas de 400 a 300 mm'])
  })

  it('every option on the modules’ variants, all free, builds with no critical finding and fewer sheets', () => {
    const sample = Object.values(MODULES).flatMap((m) => (m.kind === 'bed' ? spread<[string, FurniturePlan]>(m.benchVariants(), 16) : m.benchVariants())) as [string, FurniturePlan][]
    for (const [, plan] of sample) {
      const today = materials(plan).total
      for (const option of search(plan, allFree(plan)).options) {
        const after = materials(option.plan)
        expect(after.criticals).toEqual([])
        expect(after.total).toBe(today - option.saved)
      }
    }
    // A search per variant plus a rebuild per option: the CI runner takes about three times as long as a laptop.
  }, 60_000)
})
