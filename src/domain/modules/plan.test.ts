import { describe, expect, it } from 'vitest'
import { testCatalog } from '../fixtures/catalog.test-util'
import { Cell } from '../reading/reading'
import { BED_LABELS, BedPlan } from './bed'
import { CABINET_LABELS, CabinetConstruction, CabinetPlan } from './cabinet'
import { buildPlan, describePlanChanges, FurniturePlan, MODULES, moduleOf } from './plan'
import { TABLE_LABELS, TablePlan } from './table'

describe('the furniture registry', () => {
  it('has one module for every kind of plan, and every module is of its own kind', () => {
    const kinds = FurniturePlan.options.map((o) => o.shape.kind.value)
    expect(Object.keys(MODULES).sort()).toEqual([...kinds].sort())
    for (const option of FurniturePlan.options) {
      const module = MODULES[option.shape.kind.value]
      expect(module.kind).toBe(option.shape.kind.value)
      expect(module.schema).toBe(option)
    }
  })

  it('every bench variant is a valid plan of its module and builds', () => {
    for (const module of Object.values(MODULES)) {
      const variants = module.benchVariants()
      expect(variants.length).toBeGreaterThan(0)
      for (const [, plan] of variants) {
        expect(FurniturePlan.parse(plan).kind).toBe(module.kind)
        expect(moduleOf(plan)).toBe(module)
        expect(buildPlan(plan, testCatalog).design.pieces.length).toBeGreaterThan(0)
      }
    }
  })

  it('a plan that changes kind says what it is now', () => {
    const [[, cabinet]] = MODULES.cabinet.benchVariants()
    const [[, bed]] = MODULES.bed.benchVariants()
    expect(describePlanChanges(cabinet, bed)).toEqual(['ahora es una cama'])
    expect(describePlanChanges(bed, cabinet)).toEqual(['ahora es un gabinete'])
  })

  it('a bed resizes only in height: its length and width come from the mattress', () => {
    const [[, bed]] = MODULES.bed.benchVariants()
    expect(MODULES.bed.resize(bed, 'x', 2000)).toMatchObject({ ok: false, message: expect.stringContaining('colchón') })
    expect(MODULES.bed.resize({ ...bed, headboard: { ...bed.headboard, style: 'none' } }, 'y', 350)).toMatchObject({ ok: true, plan: { height: 350 } })
    expect(MODULES.bed.resize({ ...bed, headboard: { ...bed.headboard, style: 'plain' } }, 'y', 1200)).toMatchObject({ ok: true, plan: { headboard: { height: 1200 } } })
  })
})

describe('the labels of each module', () => {
  it('name every value of each choice, in the order of the schema', () => {
    const sets: [string, object, readonly string[]][] = [
      ['bed mattress', BED_LABELS.mattress, BedPlan.shape.mattress.options],
      ['bed drawer side', BED_LABELS.drawerSide, BedPlan.shape.drawers.shape.side.options],
      ['bed drawer position', BED_LABELS.drawerPosition, BedPlan.shape.drawers.shape.position.options],
      ['bed headboard', BED_LABELS.headboard, BedPlan.shape.headboard.shape.style.options],
      ['table use', TABLE_LABELS.use, TablePlan.shape.use.options],
      ['table pedestal', TABLE_LABELS.pedestal, TablePlan.shape.pedestal.shape.side.options],
      ['cabinet base', CABINET_LABELS.base, CabinetPlan.shape.base.options],
      ['cabinet cell', CABINET_LABELS.cell, Cell.shape.content.options],
      ['cabinet construction', CABINET_LABELS.construction, Object.keys(CabinetConstruction.shape)],
      ...Object.entries(CabinetConstruction.shape).map(([key, schema]): [string, object, readonly string[]] => [`cabinet ${key}`, CABINET_LABELS.construction[key as keyof CabinetConstruction].options, schema.options]),
    ]
    for (const [name, labels, values] of sets) expect({ name, values: Object.keys(labels) }).toEqual({ name, values: [...values] })
  })

  it('are never empty', () => {
    const texts = (value: unknown): string[] => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(texts) : [])
    for (const text of [BED_LABELS, TABLE_LABELS, CABINET_LABELS].flatMap(texts)) expect(text.trim()).not.toBe('')
  })
})
