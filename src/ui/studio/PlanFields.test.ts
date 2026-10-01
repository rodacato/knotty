import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import type { FieldSpec } from '../../domain/furniture/modules/fields'
import type { FurnitureModule } from '../../domain/furniture/modules/module'
import { MODULES, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { ServicesContext, type Services } from '../services'
import { outOfRange, PlanFields } from './PlanFields'

describe('outOfRange', () => {
  it('names the bounds a typed measure breaks, and nothing when it holds', () => {
    expect([99, 100, 300, 301].map((v) => outOfRange(v, 100, 300))).toEqual(['Entre 100 y 300 mm.', null, null, 'Entre 100 y 300 mm.'])
    expect(outOfRange(-1, 0)).toBe('Mínimo 0 mm.')
    expect(outOfRange(5000, undefined, 4000)).toBe('Máximo 4000 mm.')
    expect(outOfRange(7)).toBeNull()
  })
})

const withoutPart = (fields: FieldSpec<FurniturePlan>[]): FieldSpec<FurniturePlan>[] =>
  fields.map((f) => {
    if (f.type === 'section' || f.type === 'numbers') return { ...f, fields: withoutPart(f.fields as FieldSpec<FurniturePlan>[]) } as FieldSpec<FurniturePlan>
    const { part: _part, ...rest } = f as typeof f & { part?: string }
    return rest as FieldSpec<FurniturePlan>
  })

const render = (module: FurnitureModule<FurniturePlan>, plan: FurniturePlan) =>
  renderToStaticMarkup(createElement(ServicesContext.Provider, { value: { catalog: testCatalog } as Services }, createElement(PlanFields as never, { module, plan, onChange: () => {} })))

describe('PlanFields and the part of a field', () => {
  it('draws the same form whether or not its fields declare a part', () => {
    for (const kind of ['cabinet', 'bed', 'table'] as const) {
      const module = MODULES[kind] as unknown as FurnitureModule<FurniturePlan>
      const bare = { ...module, fields: withoutPart(module.fields) }
      const plans = module.benchVariants().map(([, plan]) => plan as FurniturePlan)
      const onLegs = plans.filter((p) => (p.kind === 'cabinet' ? p.base === 'legs' : p.kind === 'bed' ? p.legs === 'legs' : p.kind === 'table' && p.legs === 'legs'))
      expect(onLegs.length).toBeGreaterThan(0)
      for (const plan of plans) expect(render(module, plan)).toBe(render(bare, plan))
    }
  })
})
