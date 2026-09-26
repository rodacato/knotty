import { describe, expect, it } from 'vitest'
import data from '../../../public/catalog/catalog.json'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { ASSUMPTIONS } from '../checks/structure/assumptions'
import { applySettings, Catalog, HARDWARE_ROLES, hardwareByRole, NO_SETTINGS, hingeFor, pickHardware, slideFor, slideForBox } from './catalog'

describe('hardware roles', () => {
  it('every catalog item has a known role, and every role has an item', () => {
    expect(testCatalog.hardware.every((h) => (HARDWARE_ROLES as readonly string[]).includes(h.role))).toBe(true)
    expect(HARDWARE_ROLES.filter((r) => !hardwareByRole(testCatalog, r).length)).toEqual([])
  })

  it('an item without a role does not load', () => {
    const [first, ...rest] = data.hardware
    const { role: _, ...withoutRole } = first
    expect(Catalog.safeParse({ ...data, hardware: [withoutRole, ...rest] }).success).toBe(false)
  })

  it('picks the first of its role in catalog order, or the first that meets the condition', () => {
    expect(hardwareByRole(testCatalog, 'screw').map((h) => h.id)).toEqual(['screw-8x1', 'screw-8x1-1/4', 'screw-8x1-1/2', 'screw-8x2'])
    expect(pickHardware(testCatalog, 'screw')?.id).toBe('screw-8x1')
    expect(pickHardware(testCatalog, 'screw', (h) => h.length === 50.8)?.id).toBe('screw-8x2')
    expect(pickHardware(testCatalog, 'screw', () => false)).toBeUndefined()
    expect(pickHardware({ ...testCatalog, hardware: [] }, 'glue')).toBeUndefined()
  })

  it('the usual item of each role is the one the code used to name', () => {
    const usual = (r: (typeof HARDWARE_ROLES)[number]) => pickHardware(testCatalog, r)?.id
    expect(usual('hinge')).toBe('cup-hinge-35-full')
    expect(usual('nail')).toBe('brad-nail-1')
    expect(usual('shelf-pin')).toBe('shelf-pin-5')
    expect(usual('glue')).toBe('white-glue')
    expect(usual('edge-banding')).toBe('edge-banding-19')
    expect(usual('anti-tip')).toBe('anti-tip-kit')
    expect(pickHardware(testCatalog, 'drawer-slide', (h) => h.sideClearance !== null)?.id).toBe('drawer-slide-30')
  })

  it('the pocket screws of the table are catalog pocket screws of that length', () => {
    for (const row of ASSUMPTIONS.screws.pocketScrews) expect(pickHardware(testCatalog, 'pocket-screw', (h) => h.id === row.hardwareId)?.length).toBe(row.length)
  })
})

describe('drawer slides', () => {
  it('the longest that fits the depth behind the front, leaving 10 mm at the back', () => {
    expect(slideFor(testCatalog, 469)?.id).toBe('drawer-slide-45')
    expect(slideFor(testCatalog, 460)?.id).toBe('drawer-slide-45')
    expect(slideFor(testCatalog, 459)?.id).toBe('drawer-slide-40')
    expect(slideFor(testCatalog, 900)?.id).toBe('drawer-slide-50')
    expect(slideFor(testCatalog, 300)).toBeUndefined()
  })

  it('a built box takes the slide as long as it is; shorter than every slide, the shortest', () => {
    expect(slideForBox(testCatalog, 400)?.id).toBe('drawer-slide-40')
    expect(slideForBox(testCatalog, 420)?.id).toBe('drawer-slide-40')
    expect(slideForBox(testCatalog, 250)?.id).toBe('drawer-slide-30')
  })
})

describe('hinges', () => {
  it('one for each way a door sits: straight, cranked and super-cranked', () => {
    expect([hingeFor(testCatalog, 'overlay')?.id, hingeFor(testCatalog, 'half-overlay')?.id, hingeFor(testCatalog, 'inset')?.id]).toEqual(['cup-hinge-35-full', 'cup-hinge-35-half', 'cup-hinge-35-inset'])
  })

  it('a catalog saved before hinges said their door loads, and asks for none', () => {
    const old = Catalog.parse({ ...data, hardware: data.hardware.map((h) => Object.fromEntries(Object.entries(h).filter(([k]) => k !== 'mount'))) })
    expect(hardwareByRole(old, 'hinge').map((h) => h.mount)).toEqual([null, null, null])
    expect(hingeFor(old, 'inset')).toBeUndefined()
  })
})

describe('the person saved settings', () => {
  it('override prices by id and keep each item role', () => {
    const c = applySettings(testCatalog, { prices: { T18: 990, 'screw-8x2': 60, 'drawer-slide-40': null }, layout: null })
    expect(c.hardware.find((h) => h.id === 'screw-8x2')).toMatchObject({ role: 'screw', price: 60 })
    expect(c.hardware.find((h) => h.id === 'drawer-slide-40')).toMatchObject({ role: 'drawer-slide', price: null })
    expect(applySettings(testCatalog, { prices: { 'cup-hinge-35-inset': 120 }, layout: null }).hardware.find((h) => h.id === 'cup-hinge-35-inset')).toMatchObject({ mount: 'inset', price: 120 })
    expect(c.materials.find((m) => m.id === 'T18')?.price).toBe(990)
    expect(c.hardware.map((h) => h.role)).toEqual(testCatalog.hardware.map((h) => h.role))
    expect(applySettings(testCatalog, NO_SETTINGS)).toEqual(testCatalog)
  })

  it('a price saved for an id the catalog no longer has changes nothing', () => {
    expect(applySettings(testCatalog, { prices: { 'tornillo-8x2': 60 }, layout: null }).hardware).toEqual(testCatalog.hardware)
  })
})
