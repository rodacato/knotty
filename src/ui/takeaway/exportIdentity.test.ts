import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testServices } from '../store/services.test-util'
import { exportIdentity } from './exportIdentity'
import { badgePositions } from './badges'

const { services } = testServices()
const state = services.useCases.fromExample(exampleBookcase)
const date = new Date(2026, 9, 12)
describe('export identity and labels', () => {
  it('keeps source revision separate from the edited furniture revision and sanitizes filenames', () => {
    const identity = exportIdentity({ ...state, ficha: { code: 'GN-LIB-01', version: 4 }, current: 2 }, 'assembly', date)
    expect(identity.origin).toBe('GN-LIB-01 · ficha v4')
    expect(identity.file).toBe('Knotty_GN-LIB-01_ficha-v4_Librero_diseno-v2_assembly_2026-10-12')
  })
  it('does not infer a source from a matching furniture name', () => {
    const identity = exportIdentity(state, 'complete', date)
    expect(identity.origin).toContain('sin ficha de origen')
    expect(identity.file).not.toContain('GN-')
  })
  it('separates crowded badges within the view, with a leader back to each part', () => {
    const points = badgePositions(Array.from({ length: 8 }, () => [100, 100]), 8, 200, 200)
    for (let i = 0; i < points.length; i++) {
      expect(points[i].every((v) => v >= 8 && v <= 192)).toBe(true)
      for (let j = 0; j < i; j++) expect(Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1])).toBeGreaterThanOrEqual(17.6)
    }
  })
})
