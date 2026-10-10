import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REFERENCED, ROOT, sourceProblem } from '../../sources.test-util'
import { testCatalog } from '../fixtures/catalog.test-util'
import { testReferences } from '../fixtures/references.test-util'
import { buildTable, tableModule, type TablePlan } from './table'
import { tablePhases } from './tableGuide'

const plans: [string, TablePlan][] = [...tableModule.benchVariants(), ...testReferences.all().flatMap((r): [string, TablePlan][] => (r.plan?.kind === 'table' ? [[r.code, r.plan]] : []))]
const guides = plans.map(([name, plan]) => {
  const { design } = buildTable(plan, testCatalog)
  return { name, plan, design, phases: tablePhases(plan, design) }
})
const steps = [...new Map(guides.flatMap((g) => g.phases.flatMap((p) => p.steps)).map((s) => [s.text, s])).values()]
const named = (name: string) => guides.find((g) => g.name === name)!
const order = (name: string) => named(name).phases.map((p) => p.id)

function citedLine(source: string): string {
  const [, path, , row] = source.match(REFERENCED)!
  return readFileSync(join(ROOT, path), 'utf8').split('\n').find((line) => line.includes(row))!
}

describe('the build guide of a table, a desk or a bench', () => {
  it.each(steps)('«$text» cites a row of the reference that is there', ({ source }) => {
    expect(sourceProblem(source)).toBeNull()
  })

  it('no step carries a number its row does not have, nor promises a load or that it is safe', () => {
    expect(steps.flatMap((s) => (s.text.match(/\d+/g) ?? []).filter((n) => !citedLine(s.source).includes(n)).map((n) => `${n}: ${s.text}`))).toEqual([])
    expect(steps.filter((s) => /\bkg\b|segur|aguanta|soporta|resiste|garant/i.test(s.text)).map((s) => s.text)).toEqual([])
  })

  it('puts every piece of every table in one phase and only one', () => {
    const off = guides.flatMap(({ name, design, phases }) => {
      const placed = phases.flatMap((p) => p.pieces)
      const missing = design.pieces.filter((p) => !placed.includes(p.id)).map((p) => p.id)
      return missing.length || placed.length !== new Set(placed).size ? [`${name}: ${missing.join(', ') || 'a piece twice'}`] : []
    })
    expect(off).toEqual([])
  })

  it('squares the frame before the top goes on, and has only the phases of what the table has', () => {
    expect(guides.filter(({ phases }) => phases.findIndex((p) => p.id === 'frame') > phases.findIndex((p) => p.id === 'top')).map((g) => g.name)).toEqual([])
    expect(order('comedor')).toEqual(['prepare', 'frame', 'top', 'finish', 'install'])
    expect(order('centro con patas')).toEqual(['prepare', 'legs', 'frame', 'low', 'top', 'finish', 'install'])
    expect(order('escritorio con 2 cajones a la izquierda')).toEqual(['prepare', 'pedestal', 'frame', 'top', 'drawers', 'finish', 'install'])
  })

  it('finishes a glued table once assembled, and one that comes apart piece by piece before its final assembly', () => {
    const said = (name: string, phase: string) => named(name).phases.find((p) => p.id === phase)!.steps.map((s) => s.text).join(' ')
    expect(said('comedor largo', 'finish')).toMatch(/da el acabado/)
    expect(said('comedor largo', 'prepare')).not.toMatch(/acabado/)
    expect(said('comedor largo, desarmable con pernos', 'prepare')).toMatch(/dale el acabado a cada pieza/)
    expect(said('comedor largo, desarmable con pernos', 'finish')).not.toMatch(/da el acabado/)
    expect(said('comedor largo, desarmable con pernos', 'frame')).toMatch(/sin pegamento/)
  })
})
