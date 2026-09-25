import { describe, expect, it } from 'vitest'
import data from '../../../public/catalog/catalog.json'
import { applySettings, Catalog } from '../../domain/materials/catalog'
import { createJsonCatalog } from './json'

function storage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

describe('catalog settings', () => {
  it('saves and reads the person prices and cutting settings', () => {
    const s = storage()
    const settings = { prices: { T18: 990, 'screw-8x2': 60 }, layout: { trim: 10, kerf: 3, clearance: 1 } }
    createJsonCatalog('', s).saveSettings(settings)
    expect(createJsonCatalog('', s).settings()).toEqual(settings)
  })

  it('reads what the version with Spanish fields saved, prices keyed by the old hardware ids', () => {
    const old = { precios: { T18: 990, 'tornillo-8x2': 60, 'corredera-telescopica-40': 180 }, acomodo: { refilado: 10, sierra: 3, holgura: 1 } }
    const settings = createJsonCatalog('', storage({ 'despiece:v1:catalogo': JSON.stringify(old) })).settings()
    expect(settings).toEqual({ prices: { T18: 990, 'screw-8x2': 60, 'drawer-slide-40': 180 }, layout: { trim: 10, kerf: 3, clearance: 1 } })
  })

  it('prices saved before hardware had a role still apply to the catalog, by id', () => {
    const old = { precios: { 'tornillo-8x2': 60, 'corredera-telescopica-40': 180 } }
    const catalog = applySettings(Catalog.parse(data), createJsonCatalog('', storage({ 'despiece:v1:catalogo': JSON.stringify(old) })).settings())
    expect(catalog.hardware.find((h) => h.id === 'screw-8x2')).toMatchObject({ role: 'screw', price: 60 })
    expect(catalog.hardware.find((h) => h.id === 'drawer-slide-40')).toMatchObject({ role: 'drawer-slide', price: 180 })
  })

  it('ignores what it cannot read', () => {
    expect(createJsonCatalog('', storage({ 'despiece:v1:catalogo': '{"precios":' })).settings()).toEqual({ prices: {}, layout: null })
  })
})
