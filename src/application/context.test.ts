import { describe, expect, it } from 'vitest'
import { createSimulated } from '../adapters/llm/simulated/simulated'
import { analyze } from '../domain/checks/analysis'
import type { Requirement } from '../domain/checks/requirements/requirements'
import { acceptFinding } from '../domain/checks/structure/accepted'
import type { Operation } from '../domain/editing/operations/schema'
import { testCatalog } from '../domain/furniture/fixtures/catalog.test-util'
import { MODULES } from '../domain/furniture/modules/plan'
import type { TablePlan } from '../domain/furniture/modules/table'
import { currentDesign, type DesignState } from '../domain/session/state'
import { buildContext, buildPlanContext } from './context'
import { createUseCases } from './useCases'

const useCases = createUseCases({ llm: () => createSimulated(0), catalog: testCatalog, repository: { load: () => null, save: () => {}, clear: () => {} }, now: () => '2026-10-08T00:00:00Z', newId: () => 'context' })
const opened = (plan: TablePlan): DesignState => useCases.openExample({ name: plan.name, plan, notes: '' })
const desk = new Map(MODULES.table.benchVariants()).get('escritorio')!
const state = opened(desk)
const lowDesk = opened({ ...desk, dimensions: { ...desk.dimensions, height: 700 } })
const space = (limits: Partial<Requirement>): Requirement => ({ id: 'space', text: 'Mi espacio.', type: 'space', axis: 'x', min: null, max: null, ...limits })

describe('buildPlanContext', () => {
  it('names each free change on top of the plan by what it touches', () => {
    const extras = [
      { op: 'changeMaterial', ids: ['top', 'side-left'], material: 'T15' },
      { op: 'removePiece', id: 'apron-front' },
      { op: 'removeGroup', group: 'pedestal' },
      { op: 'removeJoint', id: 'joint-3' },
      { op: 'setWallAnchored', value: true },
    ] as Operation[]
    const context = buildPlanContext(state, testCatalog, extras)
    expect(context).toContain('- changeMaterial top, side-left\n- removePiece apron-front\n- removeGroup pedestal\n- removeJoint joint-3\n- setWallAnchored\n')
    expect(buildPlanContext(state, testCatalog)).not.toContain('Free changes on top of the plan')
  })

  it('gives the review by code and message, and says which findings the person accepted', () => {
    const analysis = analyze(currentDesign(lowDesk), testCatalog, [])
    if (!analysis.valid) throw new Error(analysis.errors[0].message)
    const [finding] = analysis.findings
    expect(finding).toBeDefined()
    const line = `- [${finding.severity}] ${finding.code}: ${finding.message}`
    expect(buildPlanContext(lowDesk, testCatalog)).toContain(`${line}\n`)
    const accepted = { ...lowDesk, accepted: [acceptFinding(finding, 'Lo dejo así', '2026-10-08T00:00:00Z')] }
    expect(buildPlanContext(accepted, testCatalog)).toContain(`${line} (the person accepted it as it is)`)
  })

  it('gives the errors of a design that is not valid, instead of a review', () => {
    const version = state.versions[0]
    const broken = { ...state, versions: [{ ...version, design: { ...version.design, pieces: version.design.pieces.map((p, i) => (i ? p : { ...p, material: 'NOPE' })) } }] }
    const context = buildPlanContext(broken, testCatalog)
    expect(context).toMatch(/## Errors in the current design\n- E_\w+: /)
    expect(context).not.toContain('## Structural review')
  })

  it('tells a pending change of pieces from one of the plan', () => {
    const proposal = { design: currentDesign(state), operations: [{ op: 'removePiece', id: 'apron-front' }] as Operation[], summary: 'Quitar el faldón', reason: 'Quita el faldón', critical: [], requirements: [], decisions: [], origin: null, plan: null, extras: [], holds: [] }
    const context = buildPlanContext({ ...state, proposal }, testCatalog)
    expect(context).toContain('"Quitar el faldón" for the request "Quita el faldón".\nIt changes pieces, not the plan')
    expect(context).not.toContain('Operations:')
  })
})

describe('the requirements the expert reads', () => {
  const lineOf = (r: Requirement) => buildPlanContext({ ...state, requirements: [r] }, testCatalog).split('\n').find((l) => l.startsWith(`- [${r.id}]`))

  it('carry the limits Knotty checks a space with', () => {
    expect(lineOf(space({ max: 1300 }))).toBe('- [space] Mi espacio. (space: width at most 1300 mm)')
    expect(lineOf(space({ min: 900, axis: 'z' }))).toBe('- [space] Mi espacio. (space: depth at least 900 mm)')
    expect(lineOf(space({ min: 900, max: 1300 }))).toBe('- [space] Mi espacio. (space: width at least 900 mm, at most 1300 mm)')
  })

  it('carry no limits when there are none to check', () => {
    expect(lineOf(space({}))).toBe('- [space] Mi espacio.')
    expect(lineOf(space({ axis: null, max: 1300 }))).toBe('- [space] Mi espacio.')
    expect(lineOf({ id: 'style', text: 'Que se vea ligero.', type: 'style', axis: null, min: null, max: null })).toBe('- [style] Que se vea ligero.')
  })
})

describe('a context over its budget', () => {
  const long = (word: string, times = 4000) => `${word} `.repeat(times)
  const message = (n: number) => ({ ...state.chat[0], id: `m${n}`, author: 'user' as const, text: long(`mensaje${n}`) })

  it('drops the oldest messages first and keeps the last two', () => {
    const context = buildContext({ ...state, chat: [1, 2, 3, 4, 5, 6].map(message) }, testCatalog)
    expect(context).not.toContain('mensaje4')
    expect(context).toContain('mensaje5')
    expect(context).toContain('mensaje6')
  })

  it('then drops the oldest decisions, never the requirements', () => {
    const decisions = [1, 2, 3, 4].map((n) => ({ topic: `tema${n}`, text: long(`decision${n}`, 1000) }))
    const context = buildContext({ ...state, decisions, requirements: [space({ max: 1300 })] }, testCatalog)
    expect(context).not.toContain('decision1')
    expect(context).toContain('decision4')
    expect(context).toContain('- [space] Mi espacio. (space: width at most 1300 mm)')
  })

  it('is sent whole when nothing is left to drop', () => {
    const context = buildContext({ ...state, chat: [], decisions: [], requirements: [space({ text: long('requisito') })] }, testCatalog)
    expect(context).toContain('requisito')
  })
})
