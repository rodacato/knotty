import { describe, expect, it } from 'vitest'
import { basesOf } from './examples'
import { testReferences } from './fixtures/references.test-util'
import { loadReferences } from './references'

const sample = () => {
  const { version: _, ...file } = testReferences.all()[0]
  return file
}
const load = (path: string, raw: unknown) => () => loadReferences({ [path]: raw })

describe('references', () => {
  it('are the bases of the home screen, ordered without gaps, each at a version', () => {
    const orders = testReferences.all().flatMap((r) => r.home?.order ?? [])
    expect(orders).toEqual(orders.map((_, i) => i + 1))
    expect(testReferences.all().every((r) => r.version >= 1)).toBe(true)
  })

  it('read the version from the name, as the prompts do', () => {
    const file = sample()
    const [loaded] = loadReferences({ [`./references/${file.code.toLowerCase()}.v3.json`]: file })
    expect(loaded.version).toBe(3)
  })

  it('refuse a name that is not <code>.v<version>.json', () => {
    expect(load('./references/aparador.json', sample())).toThrow(/aparador\.json: the name is/)
  })

  it('refuse a file whose code is not the one in its name', () => {
    expect(load('./references/gn-zzz-99.v1.json', sample())).toThrow(/its code is/)
  })

  it('refuse a plan the engine would not read, naming the file and the field', () => {
    const file = sample()
    const bad = { ...file, plan: { ...file.plan, dimensions: { width: -1, height: 900, depth: 400 } } }
    expect(load(`./references/${file.code.toLowerCase()}.v1.json`, bad)).toThrow(/plan\.dimensions\.width/)
  })

  it('refuse a key nobody reads, so a typo does not pass', () => {
    const file = sample()
    expect(load(`./references/${file.code.toLowerCase()}.v1.json`, { ...file, categoryy: 'storage' })).toThrow(/categoryy/)
  })

  it('refuse two versions of one reference, or two that share an order', () => {
    const file = sample()
    const name = file.code.toLowerCase()
    expect(() => loadReferences({ [`./references/${name}.v1.json`]: file, [`./references/${name}.v2.json`]: file })).toThrow(/share the code/)
    const other = { ...file, code: 'GN-ZZZ-99', id: 'other' }
    expect(() => loadReferences({ [`./references/${name}.v1.json`]: file, './references/gn-zzz-99.v1.json': other })).toThrow(/share the order/)
  })

  it('may be left off the home screen, and then come after the ones on it', () => {
    const { home, ...file } = sample()
    if (!home) throw new Error('the sample is on the home screen')
    const at = (code: string, order: number) => ({ ...file, code, id: code, home: { ...home, order } })
    const files = {
      './references/gn-zzz-01.v1.json': at('GN-ZZZ-01', 2),
      './references/gn-aaa-01.v1.json': { ...file, code: 'GN-AAA-01', id: 'aaa' },
      './references/gn-zzz-02.v1.json': at('GN-ZZZ-02', 1),
    }
    expect(loadReferences(files).map((r) => r.code)).toEqual(['GN-ZZZ-02', 'GN-ZZZ-01', 'GN-AAA-01'])
    expect(basesOf(loadReferences(files)).map((b) => b.code)).toEqual(['GN-ZZZ-02', 'GN-ZZZ-01'])
  })

  it('refuse a ficha that does not say what the engine makes of it', () => {
    const { expect: _, ...file } = sample()
    expect(load(`./references/${file.code.toLowerCase()}.v1.json`, file)).toThrow(/expect/)
  })

  it('want a checked product to say how it is supported, and only from the closed list of features', () => {
    const file = sample()
    const kc = { ...file, code: 'KC-ZZZ-01', id: 'kc' }
    expect(load('./references/kc-zzz-01.v1.json', kc)).toThrow(/a KC reference says/)
    const complete = { ...kc, support: 'adapted', difficulty: 3, features: ['legs'], adaptations: [], gaps: [] }
    expect(loadReferences({ './references/kc-zzz-01.v1.json': complete })).toHaveLength(1)
    expect(load('./references/kc-zzz-01.v1.json', { ...complete, features: ['carved'] })).toThrow(/features/)
    expect(load('./references/kc-zzz-01.v1.json', { ...complete, difficulty: 5 })).toThrow(/difficulty/)
  })
})
