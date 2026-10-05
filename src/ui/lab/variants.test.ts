import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createBench, type ModuleCheck } from '../../application/bench/bench'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { MODULES } from '../../domain/furniture/modules/plan'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { ANY_FICHA, fichasOf, groupVariants, listFichas, type FichaQuery, type Room } from './variants'

const bench = createBench({ llm: () => createSimulated(0), catalog: testCatalog })

describe('the bench drawer variant list', () => {
  it('lists every variant of every module, each with a verdict', () => {
    const groups = groupVariants(bench)
    const expected = Object.values(MODULES).reduce((n, m) => n + m.benchVariants().length, 0)
    expect(expected).toBeGreaterThan(60)
    expect(groups.flatMap((g) => g.variants)).toHaveLength(expected)
    expect(groups.map((g) => g.module).sort()).toEqual(Object.keys(MODULES).sort())
    for (const g of groups) for (const v of g.variants) expect(v.plan.kind).toBe(g.module)
  })

  it('keeps an invalid variant in the list and marks it, and never calls a variant with warnings clean', () => {
    const [first, second, third] = bench.variants()
    const check = (v: typeof first, over: Partial<ModuleCheck>): ModuleCheck => ({ module: v.module, variant: v.variant, valid: true, findings: [], warnings: [], ...over })
    const stub = {
      variants: () => [first, second, third],
      runModules: () => [check(first, { valid: false, findings: ['E_OVERLAP'] }), check(second, { warnings: ['se tocan pero no tienen unión'] }), check(third, {})],
    }
    const rows = groupVariants(stub).flatMap((g) => g.variants)
    expect(rows.map((r) => r.verdict)).toEqual(['invalid', 'note', 'ok'])
    expect(rows[1].notes).toEqual(['se tocan pero no tienen unión'])
  })

  it('lists every ficha with a verdict, in the order the store gives them', () => {
    const rows = listFichas(testReferences.all(), testCatalog)
    expect(rows.map((r) => r.reference.code)).toEqual(testReferences.all().map((r) => r.code))
    expect(rows.length).toBeGreaterThan(5)
    for (const r of rows) expect(['ok', 'note', 'invalid']).toContain(r.verdict)
  })

  it('says of each ficha what probe recorded in it, kind included', () => {
    for (const r of listFichas(testReferences.all(), testCatalog)) expect([r.reference.code, r.notes.length]).toEqual([r.reference.code, r.reference.expect.findings?.length ?? 0])
  })

  it('finds a ficha in every room its file names', () => {
    const rows = listFichas(testReferences.all(), testCatalog)
    const sideboard = (room: Room) => fichasOf(rows, { ...ANY_FICHA, room }).some((r) => r.reference.code === 'KC-APA-01')
    expect([sideboard('living'), sideboard('dining'), sideboard('bedroom')]).toEqual([true, true, false])
  })

  it('finds a ficha by its code in any form or by words of its name, within the room chosen', () => {
    const rows = listFichas(testReferences.all(), testCatalog)
    const codes = (q: Partial<FichaQuery>) => fichasOf(rows, { ...ANY_FICHA, ...q }).map((r) => r.reference.code)
    for (const text of ['KC-LIB-03', 'kc-lib-03', 'lib03', '  LIB-03 ']) expect(codes({ text })).toEqual(['KC-LIB-03'])
    const name = testReferences.latest('KC-APA-01')!.name
    expect(codes({ text: name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') })).toContain('KC-APA-01')
    expect(codes({ text: 'aparador', room: 'dining' }).every((code) => codes({ room: 'dining' }).includes(code))).toBe(true)
    expect(codes({ text: 'aparador', room: 'bedroom' })).toEqual([])
    expect(codes({ text: 'KC-LIB-14' })).toEqual([])
    expect(codes({})).toHaveLength(rows.length)
  })

  it('has a thumbnail for every ficha Knotty ships', () => {
    expect(listFichas(testReferences.all(), testCatalog).filter((r) => !r.boxes).map((r) => r.reference.code)).toEqual([])
  })
})
