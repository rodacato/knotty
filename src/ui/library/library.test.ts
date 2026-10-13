import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createIndexedRepository } from '../../adapters/persistence/indexedDb'
import { createUseCases } from '../../application/useCases'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { currentDesign } from '../../domain/session/state'
import { lossOf } from '../spotlight/swap'
import { useStore } from '../store'
import { testServices } from '../store/services.test-util'

const memory = (): Storage => {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k), clear: () => data.clear(), key: () => null, length: 0 }
}

const own = { name: exampleBookcase.name, design: exampleBookcase }
const [ficha] = testReferences.home().filter((b) => b.plan.kind === 'cabinet')
const store = () => useStore.getState()
const library = () => store().services!.library

const initial = useStore.getState()
beforeEach(async () => {
  useStore.setState(initial, true)
  const repository = await createIndexedRepository({ factory: new IDBFactory(), storage: memory(), page: null })
  const { services } = testServices()
  store().start({ ...services, useCases: createUseCases({ llm: () => ({}) as never, catalog: testCatalog, repository }), library: repository.library })
})

describe('keeping designs in «Mis muebles»', () => {
  it('stops warning about a design once a place holds it, and warns again when it changes', async () => {
    store().fromExample(own)
    expect(lossOf(store())).toBe('design')
    expect(await store().saveToPlace(1, 'Mi librero')).toBe(true)
    expect(lossOf(store())).toBeNull()

    store().addNote('Que cargue enciclopedias')
    expect(library().current()).toEqual({ place: 1, saved: false })
    expect(lossOf(store())).toBe('design')
  })

  it('tells what shows the places to read them again', async () => {
    store().fromExample(own)
    const before = store().libraryChanges
    await store().saveToPlace(1, 'Mi librero')
    store().renamePlace(1, 'El bueno')
    expect(store().libraryChanges).toBe(before + 2)
    expect(library().places()[0]?.name).toBe('El bueno')
  })

  it('does not let another piece of furniture pass for the one a place holds', async () => {
    store().fromExample(own)
    await store().saveToPlace(1, 'Mi librero')
    store().swapTo(ficha)
    expect(library().current()).toEqual({ place: null, saved: false })
    store().openDesign(store().state!)
    expect(library().current().place).toBeNull()
    expect(library().places()[0]?.design.name).toBe(exampleBookcase.name)
  })

  it('opens a kept design in the Studio, with nothing left of the one that was open', async () => {
    store().fromExample(own)
    await store().saveToPlace(2, 'Mi librero')
    store().swapTo(ficha)
    store().select(currentDesign(store().state!).pieces[0].id)
    store().openLibrary(true)

    await store().openPlace(2)
    expect(store().phase).toBe('studio')
    expect(currentDesign(store().state!).name).toBe(exampleBookcase.name)
    expect(store().selection).toBeNull()
    expect(store().libraryOpen).toBe(false)
    expect(library().current()).toEqual({ place: 2, saved: true })
    expect(store().services!.useCases.load()).toEqual(store().state)
  })

  it('leaves the open design alone when the place is empty', async () => {
    store().fromExample(own)
    const open = store().state
    await store().openPlace(4)
    expect(store().state).toBe(open)
  })

  it('keeps the open design when its place is removed, as one that belongs to no place', async () => {
    store().fromExample(own)
    await store().saveToPlace(1, 'Mi librero')
    store().removePlace(1)
    expect(store().state).not.toBeNull()
    expect(lossOf(store())).toBe('design')
  })

  it('throws away the open design without touching the places', async () => {
    store().fromExample(own)
    await store().saveToPlace(3, 'Mi librero')
    store().newDesign()
    expect(library().current().place).toBeNull()
    expect(library().places()[2]?.name).toBe('Mi librero')
  })
})
