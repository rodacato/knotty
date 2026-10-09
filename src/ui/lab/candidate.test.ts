import { describe, expect, it } from 'vitest'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases } from '../../application/useCases'
import { prepareAdoption } from '../../domain/furniture/adopt'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import type { DesignState } from '../../domain/session/state'
import { adoptionCommands, candidateOf } from './candidate'

function useCases() {
  let saved: DesignState | null = null
  return createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => saved, save: (s) => void (saved = s), clear: () => void (saved = null) } })
}

const ficha = testReferences.latest('KC-APA-01')!
const { version, ...file } = ficha
if (ficha.plan?.kind !== 'cabinet') throw new Error('KC-APA-01 is a cabinet')
const base = ficha.plan
const opened = () => {
  const u = useCases()
  const state = u.openExample({ name: ficha.name, plan: base, notes: ficha.notes, ...(ficha.finish ? { finish: ficha.finish } : {}) })
  return { u, state }
}

describe('exporting a ficha from the Studio', () => {
  it('hands back an unchanged ficha as nothing new, and an edited plan as the next version', () => {
    const { u, state } = opened()
    const same = candidateOf(state, { code: ficha.code })
    if (!same.ok) throw new Error(same.reason)
    const none = prepareAdoption({ file: file as Record<string, unknown>, version }, same.file, ficha.code, testCatalog)
    expect(none).toMatchObject({ ok: true, changes: [] })

    const plan = { ...base, dimensions: { ...base.dimensions, width: base.dimensions.width + 100 } }
    const r = u.applyPlan(state, plan)
    if (!r.ok) throw new Error(r.message)
    const edited = candidateOf(r.state, { code: ficha.code })
    if (!edited.ok) throw new Error(edited.reason)
    const next = prepareAdoption({ file: file as Record<string, unknown>, version }, edited.file, ficha.code, testCatalog)
    expect(next).toMatchObject({ ok: true, version: version + 1, changes: ['plan.dimensions.width'] })
    expect(edited.filename).toBe(`${ficha.code.toLowerCase()}.candidate.json`)
  })

  it('refuses a design the expert or the person changed piece by piece, and says why', () => {
    const { u, state } = opened()
    const piece = state.versions[0].design.pieces[0]
    const r = u.editPiece(state, piece.id, { kind: 'thickness', material: 'T15' })
    if (!r.ok) throw new Error(r.message)
    const c = candidateOf(r.state, { code: ficha.code })
    expect(c.ok).toBe(false)
    expect(c.ok ? '' : c.reason).toContain('pieza por pieza')
  })

  it('refuses a design that never came from a plan', () => {
    const u = useCases()
    const state = u.openExample({ name: 'Libro', design: opened().state.versions[0].design })
    expect(candidateOf(state, { code: null }).ok).toBe(false)
  })

  it('builds a new ficha with what a ficha needs, and names the adoption commands', () => {
    const { state } = opened()
    const c = candidateOf(state, { code: null })
    if (!c.ok) throw new Error(c.reason)
    expect(c.file).toMatchObject({ id: 'aparador-con-patas', name: base.name, plan: base })
    expect(typeof c.file.notes).toBe('string')
    expect(adoptionCommands(c.filename, null)[1]).toBe('npm run probe -- --adopt GN-XXX-00 aparador-con-patas.candidate.json')
  })
})
