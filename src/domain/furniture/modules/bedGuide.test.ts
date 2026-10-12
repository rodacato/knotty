import { describe, expect, it } from 'vitest'
import { sourceProblem } from '../../sources.test-util'
import { testCatalog } from '../fixtures/catalog.test-util'
import { bedModule, buildBed } from './bed'
import { bedPhases } from './bedGuide'

const cases = bedModule.benchVariants().map(([name, plan]) => ({ name, plan, design: buildBed(plan, testCatalog).design }))
describe('bed-specific assembly guides', () => {
  it.each(cases)('$name assigns each real piece once and puts the platform after its frame', ({ plan, design }) => {
    const phases = bedPhases(plan, design)
    const ids = phases.flatMap((p) => p.pieces)
    expect([...ids].sort()).toEqual(design.pieces.map((p) => p.id).sort())
    expect(phases.findIndex((p) => p.id === 'platform')).toBeGreaterThan(phases.findIndex((p) => p.id === 'frame'))
    expect(phases.some((p) => p.id === 'drawers')).toBe(design.pieces.some((p) => p.role === 'drawer-bottom'))
    for (const step of phases.flatMap((p) => p.steps)) expect(sourceProblem(step.source)).toBeNull()
  })
})
