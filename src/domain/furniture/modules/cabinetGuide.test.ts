import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REFERENCED, ROOT, sourceProblem } from '../../sources.test-util'
import { testCatalog } from '../fixtures/catalog.test-util'
import { testReferences } from '../fixtures/references.test-util'
import { buildCabinet, cabinetModule, type CabinetPlan } from './cabinet'
import { cabinetPhases } from './cabinetGuide'
import { MODULES } from './plan'

const plans: [string, CabinetPlan][] = [...cabinetModule.benchVariants(), ...testReferences.all().flatMap((r): [string, CabinetPlan][] => (r.plan?.kind === 'cabinet' ? [[r.code, r.plan]] : []))]
const guides = plans.map(([name, plan]) => {
  const { design } = buildCabinet(plan, testCatalog)
  return { name, plan, design, phases: cabinetPhases(plan, design) }
})
const steps = [...new Map(guides.flatMap((g) => g.phases.flatMap((p) => p.steps)).map((s) => [s.text, s])).values()]

/** The line of the reference a step cites, whole: the table row or the paragraph the cited words are in. */
function citedLine(source: string): string {
  const [, path, , row] = source.match(REFERENCED)!
  return readFileSync(join(ROOT, path), 'utf8').split('\n').find((line) => line.includes(row))!
}

describe('the build guide of a cabinet', () => {
  it.each(steps)('«$text» cites a row of the reference that is there', ({ source }) => {
    expect(sourceProblem(source)).toBeNull()
  })

  it('no step carries a number its row does not have', () => {
    const own = steps.flatMap((s) => (s.text.match(/\d+/g) ?? []).filter((n) => !citedLine(s.source).includes(n)).map((n) => `${n}: ${s.text}`))
    expect(own).toEqual([])
  })

  it('no step promises a load or that it is safe', () => {
    expect(steps.filter((s) => /\bkg\b|segur|aguanta|soporta|resiste|garant/i.test(s.text)).map((s) => s.text)).toEqual([])
  })

  it('puts every piece of every cabinet in one phase and only one, and no phase is empty of things to do', () => {
    const off = guides.flatMap(({ name, design, phases }) => {
      const placed = phases.flatMap((p) => p.pieces)
      const missing = design.pieces.filter((p) => !placed.includes(p.id)).map((p) => p.id)
      return [...(missing.length || placed.length !== new Set(placed).size ? [`${name}: ${missing.join(', ') || 'a piece twice'}`] : []), ...phases.filter((p) => !p.steps.length).map((p) => `${name}: ${p.id} has no steps`)]
    })
    expect(off).toEqual([])
  })

  it('draws apart one whole drawer and the whole base, and only pieces of their own phase', () => {
    const details = guides.flatMap(({ name, design, phases }) => phases.flatMap((phase) => (phase.detail ? [{ name, phase, drawn: design.pieces.filter((p) => phase.detail!.pieces.includes(p.id)) }] : [])))
    expect(details.filter(({ phase, drawn }) => !drawn.length || drawn.some((p) => !phase.pieces.includes(p.id))).map((d) => d.name)).toEqual([])
    expect(details.filter(({ phase, drawn }) => phase.id === 'drawers' && new Set(drawn.map((p) => p.group)).size !== 1).map((d) => d.name)).toEqual([])
    expect(details.some(({ phase }) => phase.id === 'drawers')).toBe(true)
  })

  it('goes in the order things depend on: the body, then what squares it, then what hangs from it', () => {
    const order = ['prepare', 'body', 'square', 'base', 'drawers', 'shelves', 'doors', 'finish', 'install']
    for (const { phases } of guides) expect(phases.map((p) => p.id)).toEqual(order.filter((id) => phases.some((p) => p.id === id)))
    const chest = guides.find((g) => g.name === 'cajonera')!
    expect(chest.phases.map((p) => p.id)).toEqual(expect.arrayContaining(['body', 'drawers']))
    expect(chest.phases.find((p) => p.id === 'doors')).toBeUndefined()
  })

  it('finishes a glued cabinet once assembled, and one that comes apart piece by piece before its final assembly', () => {
    const [, plan] = cabinetModule.benchVariants().find(([name]) => name === 'librero')!
    const phasesOf = (assembly: CabinetPlan['assembly']) => {
      const asked = { ...plan, assembly }
      return cabinetPhases(asked, buildCabinet(asked, testCatalog).design)
    }
    const said = (phases: ReturnType<typeof phasesOf>, id: string) => phases.find((p) => p.id === id)?.steps.map((s) => s.text).join(' ') ?? ''
    const [glued, apart] = [phasesOf('glued'), phasesOf('bolts')]
    expect(said(glued, 'finish')).toMatch(/da el acabado/)
    expect(said(glued, 'prepare')).not.toMatch(/acabado/)
    expect(said(apart, 'prepare')).toMatch(/dale el acabado a cada pieza/)
    expect(said(apart, 'finish')).not.toMatch(/da el acabado/)
    expect(said(apart, 'body')).toMatch(/sin pegamento/)
  })

  it('only the cabinet has a guide so far: another kind declares none rather than an invented order', () => {
    expect(Object.values(MODULES).filter((m) => m.phases).map((m) => m.kind)).toEqual(['cabinet'])
  })
})
