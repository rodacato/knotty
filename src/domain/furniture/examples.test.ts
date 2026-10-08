import { describe, expect, it } from 'vitest'
import { analyze } from '../checks/analysis'
import { estimatePurchase } from '../estimate/purchase'
import { testCatalog } from './fixtures/catalog.test-util'
import { exampleDesign } from './examples'
import { exampleSideboard, sideboardPlan, testBases } from './fixtures/references.test-util'
import { buildPlan } from './modules/plan'

// The bases are the first thing a person opens: every one is a plan that comes out clean, as the bench asks of every module variant.

describe('examples', () => {
  it.each(testBases.map((b) => [b.name, b] as const))('%s, built from its plan, is valid, as asked, and has no findings above a detail', (_, base) => {
    expect(buildPlan(base.plan, testCatalog).notes.filter((n) => !/^(Muesca|Patas|Tapa abatible|\d+ tapas abatibles|Tubo para colgar|\d+ tubos para colgar)/.test(n))).toEqual([])
    const { design, plan } = exampleDesign(base, testCatalog)
    expect(plan).toBe(base.plan)
    const analysis = analyze(design, testCatalog)
    expect(analysis.valid ? [] : analysis.errors.map((e) => e.message)).toEqual([])
    expect(analysis.valid && analysis.findings.filter((f) => f.severity !== 'detail').map((f) => `${f.code}: ${f.message}`)).toEqual([])
  })

  it('every base has its own id and code, and only a generic one points at a catalog product', () => {
    expect(new Set(testBases.map((b) => b.id)).size).toBe(testBases.length)
    expect(new Set(testBases.map((b) => b.code)).size).toBe(testBases.length)
    expect(testBases.filter((b) => b.inspiredBy && !b.code.startsWith('GN-')).map((b) => b.code)).toEqual([])
  })

  it('the sideboard carries its notes and finish, and its shopping list does not move', () => {
    const { design } = exampleDesign(exampleSideboard, testCatalog)
    expect(design).toMatchObject({ name: 'Aparador', wallAnchored: true, finish: 'polyurethane', dimensions: sideboardPlan.dimensions })
    expect(design.notes).toMatch(/^Aparador de comedor/)
    // On legs (step 30): no kick nor supports under the floor; six legs of two layers, four aprons and two rails. 41 on its kick.
    expect(design.pieces).toHaveLength(55)
    expect(design.pieces.some((p) => p.role === 'kick')).toBe(false)
    expect(design.pieces.filter((p) => /^leg-.*-1$/.test(p.id) && !p.id.startsWith('leg-rail'))).toHaveLength(6)
    const analysis = analyze(design, testCatalog)
    if (!analysis.valid) throw new Error('invalid')
    const purchase = estimatePurchase(design, analysis.geo, testCatalog)
    expect(purchase.sheets.map((s) => [s.material.id, s.sheets])).toEqual([['T18', 3], ['TR6', 1]])
    const count = (id: string) => purchase.hardware.find((h) => h.hardware.id === id)?.count
    expect(count('cup-hinge-35-inset')).toBe(6)
    expect(count('drawer-slide-35')).toBe(3)
    // Two pocket screws each way from every apron into its legs.
    expect(count('pocket-screw-1-1/4')).toBe(16)
    expect(purchase.finish?.finish).toBe('polyurethane')
  })
})
