import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { estimatePurchase } from '../materials/purchase'
import { testCatalog } from './fixtures/catalog.test-util'
import { EXAMPLES, exampleDesign, exampleSideboard, sideboardPlan } from './examples'
import { buildPlan } from './modules/plan'

// The curated examples are the first thing a person opens: every one must hold, and one built from a plan must come out clean.

describe('examples', () => {
  it.each(EXAMPLES.map((e) => [e.name, e] as const))('%s analyzes valid', (_, example) => {
    const { design } = exampleDesign(example, testCatalog)
    const analysis = analyze(design, testCatalog)
    expect(analysis.valid ? [] : analysis.errors).toEqual([])
  })

  it.each(EXAMPLES.filter((e) => 'plan' in e).map((e) => [e.name, e] as const))('%s, built from its plan, has no findings and every cell as asked', (_, example) => {
    if (!('plan' in example)) throw new Error('not a plan example')
    expect(buildPlan(example.plan, testCatalog).notes).toEqual([])
    const { design, plan } = exampleDesign(example, testCatalog)
    expect(plan).toBe(example.plan)
    const analysis = analyze(design, testCatalog)
    expect(analysis.valid && analysis.findings.map((f) => `${f.code}: ${f.message}`)).toEqual([])
  })

  it('the sideboard carries its notes and finish, and its shopping list does not move', () => {
    const { design } = exampleDesign(exampleSideboard, testCatalog)
    expect(design).toMatchObject({ name: 'Aparador', wallAnchored: true, finish: 'polyurethane', dimensions: sideboardPlan.dimensions })
    expect(design.notes).toMatch(/^Aparador de comedor/)
    expect(design.pieces).toHaveLength(41)
    const analysis = analyze(design, testCatalog)
    if (!analysis.valid) throw new Error('invalid')
    const purchase = estimatePurchase(design, analysis.geo, testCatalog)
    expect(purchase.sheets.map((s) => [s.material.id, s.sheets])).toEqual([['T18', 3], ['TR6', 1]])
    const count = (id: string) => purchase.hardware.find((h) => h.hardware.id === id)?.count
    expect(count('cup-hinge-35-inset')).toBe(6)
    expect(count('drawer-slide-35')).toBe(3)
    expect(purchase.finish?.finish).toBe('polyurethane')
  })
})
