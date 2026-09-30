import { describe, expect, it } from 'vitest'
import { testCatalog } from './fixtures/catalog.test-util'
import { testReferences } from './fixtures/references.test-util'
import { describeExpect, differences, probe, type Expect } from './probe'

// `npm run probe -- --all` checks the same as the first test here: what the engine makes of every shipped ficha is what its file says.

describe('probe', () => {
  it.each(testReferences.all().map((r) => [`${r.code}@${r.version}`, r] as const))('%s is as its file expects', (_, reference) => {
    expect(differences(reference.expect, probe(reference, testCatalog))).toEqual([])
  })

  it('counts the pieces and the shopping list of the sideboard on legs', () => {
    const sideboard = testReferences.latest('KC-APA-01')
    if (!sideboard) throw new Error('missing')
    expect(probe(sideboard, testCatalog)).toMatchObject({ valid: true, pieces: 55, sheets: { T18: 3, TR6: 1 }, hardware: { 'cup-hinge-35-inset': 6, 'drawer-slide-35': 3 } })
  })

  it('says a ficha the engine cannot read is not valid, and why, instead of failing', () => {
    const [first] = testReferences.all()
    if (first.plan.kind !== 'cabinet') throw new Error('the sample is not a cabinet')
    const broken = { ...first, plan: { ...first.plan, dimensions: { width: 1500, height: 700, depth: 4 } } }
    const result = probe(broken, testCatalog)
    expect(result.valid).toBe(false)
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings.every((f) => f.startsWith('error:'))).toBe(true)
  })
})

describe('differences', () => {
  const base: Expect = { valid: true, pieces: 10, findings: ['detail:R7'], sheets: { T18: 2 }, hardware: { 'cup-hinge-35': 4 } }

  it('is empty for the same figures', () => {
    expect(differences(base, { ...base })).toEqual([])
  })

  it('names each figure that moved, and the hardware that appeared or went away', () => {
    const actual: Expect = { valid: false, pieces: 12, findings: [], sheets: { T18: 3 }, hardware: { 'drawer-slide-35': 2 } }
    expect(differences(base, actual)).toEqual([
      'valid: expected true, got false',
      'pieces: expected 10, got 12',
      'findings: expected ["detail:R7"], got []',
      'sheets.T18: expected 2, got 3',
      'hardware.cup-hinge-35: expected 4, got none',
      'hardware.drawer-slide-35: expected none, got 2',
    ])
  })
})

describe('describeExpect', () => {
  it('says the verdict, the pieces and the findings, or that there are none', () => {
    expect(describeExpect({ valid: true, pieces: 55, findings: [], sheets: {}, hardware: {} })).toBe('valid, 55 pieces, findings: none')
    expect(describeExpect({ valid: false, pieces: 3, findings: ['critical:R4_TIPPING', 'detail:R7_BASE'], sheets: {}, hardware: {} })).toBe('NOT valid, 3 pieces, findings: critical:R4_TIPPING detail:R7_BASE')
  })
})
