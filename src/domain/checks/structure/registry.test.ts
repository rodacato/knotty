import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import type { Design } from '../../design/schema'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { exampleNightstand } from '../../furniture/fixtures/nightstand'
import { exampleWallCabinet } from '../../furniture/fixtures/wallCabinet'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import type { RuleCode } from './finding'
import { RULES, appliesTo, defineRule, ruleTitle } from './registry'

const CODES: RuleCode[] = ['R1_SAG', 'R2_JOINT_THICKNESS', 'R3_SCREWS', 'R4_TIPPING', 'R5_RACKING', 'R6_DOORS', 'R7_BASE', 'R8_GRAIN', 'R9_DRAWERS', 'R10_USE']

describe('rule registry', () => {
  it('registers every rule code once, in review order', () => {
    expect(RULES.map((r) => r.code)).toEqual(CODES)
  })

  it('every rule has a title for the person', () => {
    for (const rule of RULES) {
      expect(rule.title.trim()).not.toBe('')
      expect(ruleTitle(rule.code)).toBe(rule.title)
    }
  })

  it('every rule applies to all furniture for now, and a narrower one only to its kinds', () => {
    expect(RULES.every((r) => r.appliesTo === 'all' && appliesTo(r, null))).toBe(true)
    const bedsOnly = defineRule({ code: 'TEST', title: 'Prueba', appliesTo: ['bed'], check: () => [] })
    expect([appliesTo(bedsOnly, 'bed'), appliesTo(bedsOnly, 'desk'), appliesTo(bedsOnly, null)]).toEqual([true, false, false])
  })

  it('every rule starts at version 1; sag at 2 since its reference values changed, tipping at 3 and the base at 2 since they read legs, racking at 2 since it judges each box', () => {
    expect(RULES.filter((r) => r.version !== 1).map((r) => [r.code, r.version])).toEqual([['R1_SAG', 2], ['R4_TIPPING', 3], ['R5_RACKING', 2], ['R7_BASE', 2]])
    expect(defineRule({ code: 'TEST', title: 'Prueba', check: () => [] }).version).toBe(1)
  })

  it('each rule only reports findings under its own code', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }
    for (const design of [exampleBookcase, wide, exampleNightstand, exampleWallCabinet] as Design[]) {
      const analysis = analyze(design, testCatalog)
      if (!analysis.valid) throw new Error(analysis.errors[0].message)
      const ctx = { design, geo: analysis.geo, catalog: testCatalog, contacts: analysis.contacts }
      for (const rule of RULES) expect(rule.check(ctx).filter((h) => h.code !== rule.code)).toEqual([])
    }
  })
})
