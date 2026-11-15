import { describe, expect, it } from 'vitest'
import type { FurnitureModule } from '../../domain/furniture/modules/module'
import { FURNITURE_KINDS, MODULES, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { KIND_STEP, outsideSteps, sideSteps } from './steps'

describe.each(FURNITURE_KINDS)('the steps of %s', (kind) => {
  const module = MODULES[kind] as unknown as FurnitureModule<FurniturePlan>
  const [, plan] = module.benchVariants()[0]

  it('number the outside parts from 2, after the kind of furniture, without gaps', () => {
    const steps = sideSteps(plan, 'outside', 'Barniz', null, 2)
    expect(steps.map((s) => s.id)).toEqual(module.parts.list.filter((p) => p.side === 'outside').map((p) => p.id))
    expect(steps.map((s) => s.number)).toEqual(steps.map((_, i) => i + 2))
    expect(steps.every((s) => s.name && s.summary !== undefined)).toBe(true)
  })

  it('mark only the open part as active, and none while no part is open', () => {
    const outside = module.parts.list.filter((p) => p.side === 'outside')
    for (const part of outside) expect(sideSteps(plan, 'outside', 'Barniz', part.id, 2).filter((s) => s.active).map((s) => s.id)).toEqual([part.id])
    expect(sideSteps(plan, 'outside', 'Barniz', null, 2).some((s) => s.active)).toBe(false)
    expect(sideSteps(plan, 'outside', 'Barniz', 'not-a-part', 2).some((s) => s.active)).toBe(false)
  })

  it('number the inside parts from 1', () => {
    const steps = sideSteps(plan, 'inside', 'Barniz', null)
    expect(steps.map((s) => s.number)).toEqual(steps.map((_, i) => i + 1))
  })

  it('put the kind first on the strip, open while no part is, and keep exactly one step open', () => {
    const outside = module.parts.list.filter((p) => p.side === 'outside')
    const closed = outsideSteps(plan, 'Barniz', null, 'Aparador')
    expect(closed[0]).toMatchObject({ id: KIND_STEP, number: 1, summary: 'Aparador', active: true })
    expect(closed.map((s) => s.number)).toEqual(closed.map((_, i) => i + 1))
    for (const part of outside) {
      const open = outsideSteps(plan, 'Barniz', part.id, 'Aparador')
      expect(open.filter((s) => s.active).map((s) => s.id)).toEqual([part.id])
    }
    expect(outsideSteps(plan, 'Barniz', 'not-a-part', 'Aparador').filter((s) => s.active).map((s) => s.id)).toEqual([KIND_STEP])
  })
})
