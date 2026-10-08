import { describe, expect, it } from 'vitest'
import type { Requirement } from '../../domain/checks/requirements/requirements'
import { preservation, type Kept } from './preservation'

const desk = { kind: 'table', use: 'desk', name: 'Escritorio inventado', material: 'T18', dimensions: { width: 1200, height: 750, depth: 600 }, overhang: 0, shelf: false, pedestal: { side: 'none', drawers: 0 }, legs: 'panel', assembly: 'glued' }
const space: Requirement = { id: 'space-width', text: 'Mi espacio mide 120 cm', type: 'space', axis: 'x', min: null, max: 1200 }
const state = (plan: object, extra: Partial<Kept> = {}): Kept => ({ plan, requirements: [space], decisions: [{ topic: 'height', text: 'La silla es fija' }], extras: [], ...extra })
const wider = { ...desk, dimensions: { ...desk.dimensions, width: 1400 } }
const unauthorized = (before: Kept, after: Kept, allowed: string[] = []) => preservation({ before, after, allowed }).unauthorized.map((c) => c.path)

describe('preservation', () => {
  it('keeps the one change the request asked for', () => {
    expect(preservation({ before: state(desk), after: state(wider), allowed: ['plan.dimensions.width'] }).preserved).toBe(true)
  })

  it('names each change nobody asked for beside the one that was', () => {
    const after = state({ ...wider, material: 'T15', overhang: 30, name: 'Otro', assembly: 'bolts', use: 'dining' })
    expect(unauthorized(state(desk), after, ['plan.dimensions.width'])).toEqual(['plan.use', 'plan.name', 'plan.material', 'plan.overhang', 'plan.assembly'])
  })

  it('takes a field left out and its default written as the same plan, and another value as a change', () => {
    const { legs: _l, assembly: _a, ...bare } = desk
    expect(unauthorized(state(bare), state(desk))).toEqual([])
    expect(unauthorized(state(bare), state({ ...desk, assembly: 'bolts' }))).toEqual(['plan.assembly'])
    expect(unauthorized(state({ ...desk, assembly: undefined }), state(desk))).toEqual([])
    expect(unauthorized(state({ ...desk, assembly: null }), state(desk))).toEqual(['plan.assembly'])
  })

  it('sees a requirement kept by id but loosened, by one millimetre too', () => {
    expect(unauthorized(state(desk), state(desk, { requirements: [{ ...space, max: 1201 }] }))).toEqual(['requirements.space-width'])
    expect(unauthorized(state(desk), state(desk, { requirements: [] }))).toEqual(['requirements.space-width'])
    expect(unauthorized(state(desk), state(desk, { requirements: [{ ...space }] }))).toEqual([])
  })

  it('counts decisions and extras, and a parent path allows its children', () => {
    const after = state({ ...desk, pedestal: { side: 'left', drawers: 3 } }, { decisions: [{ topic: 'height', text: 'Libre' }], extras: [{ op: 'changeMaterial', ids: ['top'], material: 'T15' }] })
    expect(unauthorized(state(desk), after, ['plan.pedestal'])).toEqual(['decisions.height', 'extras'])
  })

  it('finds nothing in an answer that changes nothing', () => {
    expect(preservation({ before: state(desk), after: state(desk) })).toEqual({ preserved: true, changes: [], unauthorized: [] })
  })

  it('does not take the order of keys for a change, in the plan, a requirement, a decision or an extra', () => {
    const extra = { op: 'changeMaterial', ids: ['top'], material: 'T15' }
    const reversed = (o: object) => Object.fromEntries(Object.entries(o).reverse())
    const after = state({ ...desk, pedestal: { drawers: 0, side: 'none' } }, { requirements: [reversed(space) as Requirement], decisions: [{ text: 'La silla es fija', topic: 'height' }], extras: [reversed(extra)] })
    expect(unauthorized(state(desk, { extras: [extra] }), after)).toEqual([])
  })
})
