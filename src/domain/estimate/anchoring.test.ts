import { describe, expect, it } from 'vitest'
import { createReferenceStore } from '../../adapters/references/store'
import { ASSUMPTIONS } from '../assumptions'
import { resolveGeometry } from '../design/resolve'
import { WALLS, type Design, type Wall } from '../design/schema'
import { exampleDesign, exampleOf } from '../furniture/examples'
import { exampleBookcase } from '../furniture/fixtures/bookcase'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { exampleNightstand } from '../furniture/fixtures/nightstand'
import { exampleWallCabinet } from '../furniture/fixtures/wallCabinet'
import { buildPlan, MODULES } from '../furniture/modules/plan'
import { anchoringAdvice, anchoringOf } from './anchoring'
import { estimatePurchase } from './purchase'

const geo = (d: Design) => {
  const r = resolveGeometry(d, testCatalog)
  if (!r.ok) throw new Error(d.name)
  return r.value
}
const on = (d: Design, wall: Wall) => anchoringOf({ ...d, wall }, geo(d), testCatalog)
const plugs = (d: Design, wall: Wall) => estimatePurchase({ ...d, wall }, geo(d), testCatalog).hardware.filter((h) => h.hardware.role === 'wall-plug' || h.hardware.role === 'toggle-plug')

describe('what an anchored piece is fixed to the wall with', () => {
  it('says nothing until the wall is said, and nothing of a piece that is not anchored', () => {
    expect(on(exampleBookcase, 'unknown')).toBeNull()
    expect(anchoringOf(exampleBookcase, geo(exampleBookcase), testCatalog)).toBeNull()
    expect(on(exampleNightstand, 'concrete')).toBeNull()
    expect(plugs(exampleBookcase, 'unknown')).toEqual([])
    expect(plugs(exampleNightstand, 'concrete')).toEqual([])
  })

  it('gives a standing piece one plug per anchor, of the kind its wall takes', () => {
    expect(plugs(exampleBookcase, 'concrete').map((h) => [h.hardware.role, h.count])).toEqual([['wall-plug', 2]])
    expect(plugs(exampleBookcase, 'brick').map((h) => [h.hardware.role, h.count])).toEqual([['wall-plug', 2]])
    expect(plugs(exampleBookcase, 'block').map((h) => [h.hardware.role, h.count])).toEqual([['toggle-plug', 2]])
  })

  it('lists no plug for a standing piece on drywall, and says its anchor goes to a stud', () => {
    expect(plugs(exampleBookcase, 'drywall')).toEqual([])
    expect(anchoringAdvice(on(exampleBookcase, 'drywall'))).toMatch(/poste/)
  })

  it('counts the plugs of a hung piece by its loaded weight, never fewer than two', () => {
    const hung = on(exampleWallCabinet, 'drywall')!
    expect(hung.hung).toBe(true)
    expect(hung.weight).toBeGreaterThan(hung.pullOut!)
    expect(hung.count).toBe(Math.max(2, Math.ceil(hung.weight! / ASSUMPTIONS.anchoring.capacity.drywall)))
    expect(plugs(exampleWallCabinet, 'drywall').map((h) => [h.hardware.role, h.count])).toEqual([['toggle-plug', hung.count]])
    expect(on(exampleWallCabinet, 'concrete')!.count).toBe(2)
    expect(anchoringAdvice(hung)).toContain(`${hung.weight} kg`)
  })

  it('asks for more plugs when the same cabinet carries more', () => {
    const loaded = { ...exampleWallCabinet, pieces: exampleWallCabinet.pieces.map((p) => (p.normal === 'y' ? { ...p, load: 'heavy' as const } : p)) }
    expect(on(loaded, 'drywall')!.weight).toBeGreaterThan(on(exampleWallCabinet, 'drywall')!.weight!)
    expect(on(loaded, 'drywall')!.count).toBeGreaterThanOrEqual(on(exampleWallCabinet, 'drywall')!.count)
  })

  it('answers for every anchored ficha and module variant on every wall', () => {
    const fichas = createReferenceStore(import.meta.glob<unknown>('../../adapters/references/*.json', { import: 'default', eager: true })).all().map((r) => exampleDesign(exampleOf(r), testCatalog).design)
    const variants = Object.values(MODULES).flatMap((m) => m.benchVariants().map(([, plan]) => buildPlan(plan, testCatalog).design))
    const anchored = [...fichas, ...variants].filter((d) => d.wallAnchored)
    expect(anchored.length).toBeGreaterThan(50)
    for (const d of anchored) {
      for (const wall of WALLS.filter((w) => w !== 'unknown')) {
        const a = on(d, wall)!
        const toStud = !a.hung && wall === 'drywall'
        expect(a.plug === null, `${d.name} on ${wall}`).toBe(toStud)
        expect(a.count, `${d.name} on ${wall}`).toBeGreaterThanOrEqual(toStud ? 0 : 2)
        expect(a.count, `${d.name} on ${wall}`).toBeLessThanOrEqual(4)
      }
    }
  })
})
