import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { exampleDesign } from '../../domain/furniture/examples'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { fichaLink, linkedFicha, optionsOf } from './link'

const bases = testReferences.home()
const table = bases.find((b) => b.code === 'KC-MES-03')!
const at = (link: string) => ({ search: new URL(link).search, hash: new URL(link).hash })
const place = { origin: 'https://example.test', pathname: '/knotty/' }
const assemblyOf = (example: { plan: object }) => (example.plan as { assembly?: string }).assembly
const builds = (example: Parameters<typeof exampleDesign>[0]) => analyze(exampleDesign(example, testCatalog).design, testCatalog).valid

describe('the link to a ficha', () => {
  it('comes back as the same ficha, wherever the app is served from', () => {
    const link = fichaLink('KC-MES-03', {}, place)
    expect(link).toBe('https://example.test/knotty/?ficha=KC-MES-03')
    expect(linkedFicha(at(link), bases)).toEqual({ example: table, search: '', hash: '' })
  })

  it('reads the code in any case and leaves the rest of the address as it was', () => {
    expect(linkedFicha({ search: '?q=mesa&ficha=kc-mes-03', hash: '#top' }, bases)).toEqual({ example: table, search: '?q=mesa', hash: '#top' })
  })

  it('asks for nothing without a ficha, and opens nothing for a code no ficha has', () => {
    expect(linkedFicha({ search: '?q=mesa&acabado=paint', hash: '' }, bases)).toBeNull()
    expect(linkedFicha({ search: '?ficha=KC-NOPE-99', hash: '' }, bases)).toEqual({ example: null, search: '', hash: '' })
  })
})

describe('the options of the whole piece in a link', () => {
  it('carries the finish and the assembly, and they open as they were said', () => {
    const link = fichaLink('KC-MES-03', { acabado: 'danish-oil', armado: 'bolts' }, place)
    expect(link).toBe('https://example.test/knotty/?ficha=KC-MES-03&acabado=danish-oil&armado=bolts')
    const { example } = linkedFicha(at(link), bases, builds)!
    expect([example!.finish, assemblyOf(example!), example!.code]).toEqual(['danish-oil', 'bolts', 'KC-MES-03'])
    expect({ ...example!.plan, assembly: assemblyOf(table) }).toEqual({ ...table.plan, assembly: assemblyOf(table) })
  })

  it('reads them after the # as well', () => {
    expect(linkedFicha({ search: '?ficha=KC-MES-03', hash: '#acabado=paint' }, bases)).toMatchObject({ example: { finish: 'paint' }, hash: '' })
  })

  it('leaves the ficha as it ships for a value Knotty does not know, or one that does not build', () => {
    expect(linkedFicha({ search: '?ficha=KC-MES-03&acabado=glitter&armado=welded&material=T99', hash: '' }, bases, builds)!.example).toEqual(table)
    expect(linkedFicha({ search: '?ficha=KC-MES-03&acabado=paint&armado=bolts', hash: '' }, bases, () => false)!.example).toEqual(table)
  })

  it('says only what the design has that its ficha does not ship with', () => {
    const shipped = { plan: table.plan, design: exampleDesign(table, testCatalog).design }
    expect(optionsOf(table.plan, shipped.design, shipped)).toEqual({})
    const mine = exampleDesign({ ...table, finish: 'paint', plan: { ...table.plan, assembly: 'cams' } as typeof table.plan }, testCatalog)
    expect(optionsOf(mine.plan!, mine.design, shipped)).toEqual({ acabado: 'paint', armado: 'cams' })
  })

  it('every ficha that has an assembly opens from its own link with each of them', () => {
    const broken = bases.filter((b) => b.plan.kind !== 'shoeRack').flatMap((b) => ['glued', 'bolts', 'cams'].filter((armado) => assemblyOf(linkedFicha(at(fichaLink(b.code, { armado }, place)), bases, builds)!.example!) !== armado).map((armado) => `${b.code} ${armado}`))
    expect(broken).toEqual([])
  })
})
