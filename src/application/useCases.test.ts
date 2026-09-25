import { describe, expect, it, vi } from 'vitest'
import { analyze } from '../domain/analysis'
import { createSimulated } from '../adapters/llm/simulated/simulated'
import { startAt, makePiece, ref, extent } from '../domain/design/builders'
import type { BedPlan } from '../domain/modules/bed'
import { DEFAULT_CONSTRUCTION, type CabinetPlan } from '../domain/modules/cabinet'
import type { Design } from '../domain/design/schema'
import type { Operation } from '../domain/operations/schema'
import { testCatalog } from '../domain/fixtures/catalog.test-util'
import { exampleBookcase } from '../domain/fixtures/bookcase'
import { exampleWallCabinet } from '../domain/fixtures/wallCabinet'
import { findingKey } from '../domain/structure/finding'
import { ruleTitle } from '../domain/structure/registry'
import { currentDesign, type DesignState } from '../domain/session/state'
import type { DesignRepository } from '../ports/DesignRepository'
import { InvalidResponse, type LLMProvider, type PlanAdjustment, type AdjustmentResponse } from '../ports/LLMProvider'
import { createUseCases, currentPlan, reviewSignature } from './useCases'
import { buildContext } from './context'
import { noticeBoard } from './notices'
import { fixesFor } from '../domain/fixes/fixes'
import { answerItem, suggestionItem } from '../domain/tray/tray'

const memory = (): DesignRepository & { state: DesignState | null } => ({
  state: null,
  load() {
    return this.state
  },
  save(e) {
    this.state = e
  },
  clear() {
    this.state = null
  },
})

let id = 0
const setup = (llm: LLMProvider = createSimulated(0)) => {
  const repository = memory()
  return { repository, ...createUseCases({ llm: () => llm, catalog: testCatalog, repository, now: () => '2026-09-24T10:00:00Z', newId: () => `m${++id}` }) }
}
const newSignal = () => new AbortController().signal
const BOOKCASE_MEASURES = { width: 600, height: 1800, depth: 300 }
const emptyAdjustment: AdjustmentResponse = { explanation: 'Listo', summary: '', operations: [], questions: [], requestedPhotos: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], acceptedRisks: [] }

async function initialBookcase(c = setup()) {
  return c.reconstruct({ measures: BOOKCASE_MEASURES, photos: [{ angle: 'front', base64: '' }], thumbnails: [], notes: '' }, newSignal())
}

describe('reconstruct', () => {
  it('builds version 1 with the expert explanation and questions, and saves it', async () => {
    const c = setup()
    const stages: string[] = []
    const state = await c.reconstruct({ measures: BOOKCASE_MEASURES, photos: [{ angle: 'front', base64: '' }], thumbnails: [], notes: '' }, newSignal(), (e) => stages.push(e))
    expect(state.versions).toHaveLength(1)
    expect(currentDesign(state).name).toBe('Librero')
    expect(state.chat[1].questions.flatMap((p) => p.options)).toContain('Libros')
    expect(state.chat[1].requestedPhotos).toEqual([{ angle: 'inside', reason: 'Para ver cómo va fijada la trasera' }])
    expect(stages).toEqual(['reading-photos', 'reading-photos', 'designing', 'designing-pieces', 'checking', 'structure'])
    expect(c.repository.state).toEqual(state)
  })
})

describe('reconstruct without photos', () => {
  it('builds the design from the description, without asking for photos, and offers the drawer as a question', async () => {
    const c = setup()
    const state = await c.reconstruct(
      { measures: { width: 600, height: 1800, depth: 500 }, photos: [], thumbnails: [], notes: 'Un librero con repisas para libros y un cajón abajo' },
      newSignal(),
    )
    expect(currentDesign(state).name).toBe('Librero')
    expect(state.chat[1].requestedPhotos).toEqual([])
    expect(state.chat[1].text).toContain('Con tu descripción')
    const options = state.chat[1].questions.flatMap((p) => p.options ?? [])
    expect(options).toContain('Agrega un cajón abajo')
    const withDrawer = await c.adjust(state, 'Agrega un cajón abajo', newSignal(), undefined, `${state.chat[1].id}#p1`)
    expect(currentDesign(withDrawer).pieces.some((p) => p.group === 'drawer-1')).toBe(true)
  })

  it('the description stays in the chat and, without measures, the expert estimates them and says so', async () => {
    const state = await setup().reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Un buró sencillo con una repisa' }, newSignal())
    expect(state.chat[0]).toMatchObject({ author: 'user', text: 'Un buró sencillo con una repisa\n\nNo sé las medidas.' })
    expect(currentDesign(state).name).toBe('Buró')
    expect(state.measures).toEqual(currentDesign(state).dimensions)
    expect(state.chat[1].text).toContain('las estimé')
    expect(state.chat[1].suggestions.length).toBeGreaterThan(0)
  })

  it('the simulated expert does not make up a bookcase when asked for other furniture', async () => {
    await expect(setup().reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Una banca para el recibidor' }, newSignal())).rejects.toThrow(/conecta un experto real/)
  })
})

describe('provider warnings', () => {
  it('they reach the chat along with the expert explanation', async () => {
    const simulated = createSimulated(0)
    const warning = 'SheLLM no aceptó las fotos, así que el experto trabajó sin verlas.'
    const llm: LLMProvider = { ...simulated, reconstruct: async (s, signal) => ({ ...(await simulated.reconstruct(s, signal)), warnings: [warning] }) }
    const state = await initialBookcase(setup(llm))
    expect(state.chat[1].text).toContain(warning)
  })
})

describe('adjust', () => {
  it('"hazlo de 90 cm" stays a pending proposal because of sag, and "divisor" resolves it', async () => {
    const c = setup()
    const initial = await initialBookcase(c)
    const wide = await c.adjust(initial, 'Hazlo de 90 cm de ancho para mi espacio', newSignal())
    expect(wide.proposal?.critical.map((x) => x.code)).toContain('R1_SAG')
    expect(wide.versions).toHaveLength(1)
    expect(wide.chat.at(-1)?.proposal).toBe('pending')

    const applied = c.applyProposal(wide)
    expect(applied.versions).toHaveLength(2)
    expect(currentDesign(applied).dimensions.width).toBe(900)
    expect(applied.requirements.map((r) => r.id)).toEqual(['space-width'])

    const withDivider = await c.adjust(applied, 'Agrega un divisor al centro', newSignal())
    expect(withDivider.versions).toHaveLength(3)
    expect(currentDesign(withDivider).pieces.some((p) => p.id === 'divider')).toBe(true)
    expect(withDivider.chat.at(-1)?.version).toBe(3)
  })

  it('for a critical finding without options from the expert, it offers the rules alternatives; choosing one resolves everything together', async () => {
    const c = setup()
    const pending = await c.adjust(await initialBookcase(c), 'Hazlo de 90 cm de ancho', newSignal())
    const options = pending.chat.at(-1)!.questions[0].options!
    expect(options).toContain('Agregar un divisor vertical al centro')
    const resolved = await c.adjust(pending, options[0], newSignal(), undefined, pending.chat.at(-1)!.id)
    expect(resolved.proposal).toBeNull()
    expect(currentDesign(resolved).dimensions.width).toBe(900)
    expect(currentDesign(resolved).pieces.map((p) => p.id)).toEqual(expect.arrayContaining(['divider', 'bottom-support', 'shelf-1-right']))
    expect(resolved.versions.at(-1)?.summary).toBe('Ensanchar con divisor al centro')
  })

  it('an option Knotty can build applies the proposal and then the solution, with no expert call', async () => {
    const llm = createSimulated(0)
    const c = setup(llm)
    const pending = await c.adjust(c.fromExample(exampleBookcase), 'Hazlo de 90 cm de ancho', newSignal())
    const question = pending.chat.at(-1)!
    const option = 'Agregar un apoyo al centro, debajo del piso'
    expect(question.questions[0].options).toEqual([option, 'Agregar un divisor vertical al centro'])
    expect(question.solutions).toEqual([{ question: 0, option, alternative: 'center-divider' }])

    const spies = (Object.keys(llm) as (keyof LLMProvider)[]).filter((k) => typeof llm[k] === 'function').map((k) => vi.spyOn(llm, k as never))
    const resolved = c.answerWithFix(pending, question.id, 0, option)!
    expect(spies.length).toBeGreaterThan(3)
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    expect(resolved.proposal).toBeNull()
    expect(resolved.versions.map((v) => v.summary)).toEqual([pending.versions[0].summary, 'Ensanchar a 90 cm', option])
    expect(resolved.chat.find((m) => m.id === question.id)).toMatchObject({ proposal: 'applied', answered: true })
    expect(resolved.chat.at(-1)).toMatchObject({ author: 'user', text: `Resolví: ${option}.`, version: resolved.current })
    const design = currentDesign(resolved)
    expect(design.dimensions.width).toBe(900)
    expect(design.pieces.filter((p) => p.id.startsWith('support-')).map((p) => p.id)).toEqual(['support-bottom', 'support-shelf-1', 'support-shelf-2', 'support-shelf-3', 'support-shelf-4'])
    const analysis = analyze(design, testCatalog)
    if (!analysis.valid) throw new Error('the fix left an invalid design')
    const sagging = pending.proposal!.critical.flatMap((h) => h.pieces)
    expect(analysis.findings.filter((h) => h.severity === 'critical' && h.pieces.some((p) => sagging.includes(p)))).toEqual([])
    expect(c.repository.state).toEqual(resolved)
  })

  it('an option Knotty cannot build goes back to be sent to the expert', async () => {
    const c = setup()
    const pending = await c.adjust(c.fromExample(exampleBookcase), 'Hazlo de 90 cm de ancho', newSignal())
    const question = pending.chat.at(-1)!
    expect(c.answerWithFix(pending, question.id, 0, 'Agregar un divisor vertical al centro')).toBeNull()
    const unbuildable = { ...pending, chat: pending.chat.map((m) => (m.id === question.id ? { ...m, solutions: [{ question: 0, option: 'Dividirla en dos puertas', alternative: 'two-doors' }] } : m)) }
    expect(c.answerWithFix(unbuildable, question.id, 0, 'Dividirla en dos puertas')).toBeNull()
    expect(c.answerWithFix(c.discardProposal(pending), question.id, 0, 'Agregar un apoyo al centro, debajo del piso')).toBeNull()
  })

  it('a change without critical findings makes a new version', async () => {
    const c = setup()
    const state = await c.adjust(await initialBookcase(c), 'Refuerza la base', newSignal())
    expect(state.versions.map((v) => v.summary)).toEqual(['Reconstrucción desde fotos', 'Reforzar la base'])
    expect(state.versions[1].operations[0]).toBe('+base-brace')
  })

  it('retries with the errors and, if it fails, says so without applying anything', async () => {
    const requests: (string | null)[] = []
    const broken: AdjustmentResponse = {
      explanation: 'Saco el lateral',
      summary: 'Sacar lateral',
      operations: [{ op: 'move', id: 'side-left', axis: 'x', at: { type: 'mm', mm: -50 } }],
      questions: [],
      requestedPhotos: [],
      requirements: { add: [], remove: [] },
      decisions: [],
      acceptedRisks: [],
      suggestions: [],
    }
    const simulated = createSimulated(0)
    const llm: LLMProvider = {
      ...simulated,
      async proposeAdjustment(s) {
        requests.push(s.correction?.errors ?? null)
        return { value: broken, origin: { promptId: 't', provider: 't', model: 't' }, usage: {} }
      },
    }
    const c = setup(llm)
    const initial = await initialBookcase(c)
    const state = await c.adjust(initial, 'Quita el lateral izquierdo', newSignal())
    expect(requests).toHaveLength(3)
    expect(requests[1]).toContain('E_')
    expect(state.versions).toHaveLength(1)
    expect(state.chat.at(-1)).toMatchObject({ author: 'expert', error: true })
  })

  it('an answer with an invalid format goes back to be corrected', async () => {
    let calls = 0
    const simulated = createSimulated(0)
    const llm: LLMProvider = {
      ...simulated,
      async proposeAdjustment(s, signal) {
        if (calls++ === 0) throw new InvalidResponse({ garbage: true }, 'missing "operations"')
        expect(s.correction?.errors).toBe('missing "operations"')
        return simulated.proposeAdjustment(s, signal)
      },
    }
    const c = setup(llm)
    const state = await c.adjust(await initialBookcase(c), 'Refuerza la base', newSignal())
    expect(state.versions).toHaveLength(2)
  })

  it('a provider error stays in the chat', async () => {
    const llm: LLMProvider = {
      ...createSimulated(0),
      proposeAdjustment: async () => {
        throw new Error('La API key no es válida.')
      },
    }
    const c = setup(llm)
    const state = await c.adjust(await initialBookcase(c), 'Refuerza la base', newSignal())
    expect(state.chat.at(-1)).toMatchObject({ text: 'La API key no es válida.', error: true })
  })

  it('a photo the expert asked for travels to the model, confirms the piece and stays as a thumbnail', async () => {
    const seen: number[] = []
    const simulated = createSimulated(0)
    const llm: LLMProvider = { ...simulated, proposeAdjustment: (s, signal) => (seen.push(s.photos.length), simulated.proposeAdjustment(s, signal)) }
    const c = setup(llm)
    const initial = await initialBookcase(c)
    expect(currentDesign(initial).pieces.find((p) => p.id === 'back')?.confidence).toBe('low')
    const photo = { angle: 'inside', base64: 'AAA', thumbnail: 'data:image/jpeg;base64,AAA' }
    const state = await c.adjust(initial, 'Te mando la foto: interior', newSignal(), undefined, `${initial.chat[1].id}#f:interior`, photo)
    expect(state.chat[1]).toMatchObject({ answers: ['f:interior'], answered: false })
    expect(seen).toEqual([1])
    expect(currentDesign(state).pieces.find((p) => p.id === 'back')?.confidence).toBe('high')
    expect(state.thumbnails.map((m) => m.angle)).toContain('inside')
    expect(state.chat.at(-2)?.thumbnail).toBe(photo.thumbnail)
  })

  it('confirming a sketched piece by hand makes a version', async () => {
    const c = setup()
    const state = c.confirmPiece(await initialBookcase(c), 'back')
    expect(currentDesign(state).pieces.find((p) => p.id === 'back')?.confidence).toBe('high')
    expect(state.versions.at(-1)?.summary).toBe('Confirmar trasera')
    expect(c.confirmPiece(state, 'back')).toBe(state)
  })

  it('answering a question marks it answered', async () => {
    const c = setup()
    const initial = await initialBookcase(c)
    const state = await c.adjust(initial, 'Libros', newSignal(), undefined, initial.chat[1].id)
    expect(state.chat[1].answered).toBe(true)
    const partial = await c.adjust(initial, 'Libros', newSignal(), undefined, `${initial.chat[1].id}#p1`)
    expect(partial.chat[1]).toMatchObject({ answers: ['p1'], answered: false })
    const together = await c.adjust(initial, 'Libros', newSignal(), undefined, `${initial.chat[1].id}#p0,p1`)
    expect(together.chat[1].answers).toEqual(['p0', 'p1'])
    expect(state.requirements.map((r) => r.id)).toContain('book-load')
  })
})

describe('versions', () => {
  it('going back to a version makes a new one equal to it', async () => {
    const c = setup()
    const v2 = await c.adjust(await initialBookcase(c), 'Refuerza la base', newSignal())
    const v3 = c.backToVersion(v2, 1)
    expect(v3.versions.map((v) => v.n)).toEqual([1, 2, 3])
    expect(currentDesign(v3)).toEqual(v3.versions[0].design)
  })

  it('going back to a version restores its decisions but leaves the requirements alone', async () => {
    const c = setup()
    const withNote = c.addRequirement(await initialBookcase(c), 'Lo voy a pintar')
    const v2 = await c.adjust(withNote, 'Refuerza la base', newSignal())
    expect(v2.decisions).toHaveLength(1)
    const v3 = c.backToVersion(v2, 1)
    expect(v3.decisions).toEqual([])
    expect(v3.requirements.map((r) => r.text)).toEqual(['Lo voy a pintar'])
    expect(c.backToVersion(v3, 2).decisions.map((d) => d.topic)).toEqual(['base'])
  })

  it('going back to the current version does nothing', async () => {
    const c = setup()
    const v1 = await initialBookcase(c)
    expect(c.backToVersion(v1, 1)).toBe(v1)
  })

  it('the person notes and decisions can be added and removed', async () => {
    const c = setup()
    const withNote = c.addRequirement(await initialBookcase(c), '  Lo voy a pintar de blanco ')
    expect(withNote.requirements).toEqual([expect.objectContaining({ text: 'Lo voy a pintar de blanco', type: 'other' })])
    expect(c.removeRequirement(withNote, withNote.requirements[0].id).requirements).toEqual([])
    const withDecision = await c.adjust(withNote, 'Refuerza la base', newSignal())
    expect(withDecision.decisions.map((d) => d.topic)).toEqual(['base'])
    expect(c.removeDecision(withDecision, 'base').decisions).toEqual([])
  })

  it('discarding a proposal makes no version', async () => {
    const c = setup()
    const pending = await c.adjust(await initialBookcase(c), 'Hazlo de 90 cm de ancho', newSignal())
    const discarded = c.discardProposal(pending)
    expect(discarded.proposal).toBeNull()
    expect(discarded.versions).toHaveLength(1)
    expect(discarded.chat.at(-1)).toMatchObject({ proposal: 'discarded', answered: true })
  })
})

describe('buildContext', () => {
  it('includes design, geometry, review, requirements, log and recent chat', async () => {
    const c = setup()
    const state = c.applyProposal(await c.adjust(await initialBookcase(c), 'Hazlo de 90 cm de ancho', newSignal()))
    const text = buildContext(state, testCatalog)
    for (const part of ['## Current design (v2)', 'side-right: 882–900', 'R1_SAG', 'El espacio mide 90 cm', 'v2: Ensanchar a 90 cm', 'Person: Hazlo de 90 cm']) expect(text).toContain(part)
    // The longest span of a sagging board still reaches the expert, after its ways out.
    expect(text).toMatch(/R1_SAG .*Alternatives: .*; Claro máximo con \d+ mm \{"span":\d+\}/)
  })
})

describe('reviewPurchase', () => {
  it('saves the checks and the carpenter opinion with the version signature', async () => {
    const c = setup()
    const initial = await initialBookcase(c)
    const state = c.saveReview(initial, await c.reviewPurchase(initial, testCatalog, newSignal()))
    expect(state.review).toMatchObject({ verdict: 'viable', error: null, signature: reviewSignature(initial, testCatalog) })
    expect(state.review!.checks.find((x) => x.id === 'confirmed')?.status).toBe('warning')
    expect(state.review!.carpenter?.tips.length).toBeGreaterThan(0)
    expect(c.repository.state?.review).toEqual(state.review)
    const changed = await c.adjust(state, 'Refuerza la base', newSignal())
    expect(reviewSignature(changed, testCatalog)).not.toBe(state.review!.signature)
  })

  it('the signature follows the design, not the version number', async () => {
    const c = setup()
    const v1 = await initialBookcase(c)
    const v2 = await c.adjust(v1, 'Refuerza la base', newSignal())
    const v3 = c.backToVersion(v2, 1)
    expect(v3.current).not.toBe(v1.current)
    expect(reviewSignature(v3, testCatalog)).toBe(reviewSignature(v1, testCatalog))
    const design = currentDesign(v1)
    const moved = { ...v1, versions: v1.versions.map((v) => (v.n === v1.current ? { ...v, design: { ...design, pieces: design.pieces.map((p, i) => (i === 0 ? { ...p, name: `${p.name} bis` } : p)) } } : v)) }
    expect(reviewSignature(moved, testCatalog)).not.toBe(reviewSignature(v1, testCatalog))
  })

  it('the carpenter cannot approve what the arithmetic marks impossible', async () => {
    const simulated = createSimulated(0)
    const llm: LLMProvider = { ...simulated, reviewPurchase: async (s, signal) => ({ ...(await simulated.reviewPurchase(s, signal)), value: { verdict: 'viable', summary: 'Todo bien', problems: [], tips: [] } }) }
    const c = setup(llm)
    const narrow = { ...testCatalog, layout: { ...testCatalog.layout, trim: 400 } }
    const verdict = await c.reviewPurchase(await initialBookcase(c), narrow, newSignal())
    expect(verdict.verdict).toBe('not-viable')
  })

  it('if the carpenter does not answer, the arithmetic review stays with the reason', async () => {
    const llm: LLMProvider = { ...createSimulated(0), reviewPurchase: async () => Promise.reject(new Error('No se pudo conectar con SheLLM.')) }
    const c = setup(llm)
    const verdict = await c.reviewPurchase(await initialBookcase(c), testCatalog, newSignal())
    expect(verdict).toMatchObject({ verdict: 'viable', carpenter: null, error: 'No se pudo conectar con SheLLM.' })
  })
})

describe('never throw away a paid design', () => {
  // A shelf floating in the middle, touching nothing: it resolves, but no rule can say where it should go.
  const withFloating = (d: Design): Design => ({
    ...d,
    pieces: [
      ...d.pieces,
      {
        ...d.pieces.find((p) => p.id === 'shelf-1')!,
        id: 'shelf-extra',
        name: 'Entrepaño extra',
        x: { from: ref('side-left.x1', 60), to: ref('side-right.x0', -60), length: null },
        y: { from: ref('shelf-1.y1', 100), to: null, length: null },
        z: { from: ref('back.z1', 60), to: ref('furniture.z1', -60), length: null },
      },
    ],
  })
  const withOverlap = (d: Design): Design => ({ ...d, pieces: [...d.pieces, { ...d.pieces.find((p) => p.id === 'shelf-1')!, id: 'shelf-copy', name: 'Entrepaño copia' }] })
  const changing = (change: (d: Design) => Design): LLMProvider => {
    const simulated = createSimulated(0)
    return { ...simulated, reconstruct: async (s, signal) => { const r = await simulated.reconstruct(s, signal); return { ...r, value: { ...r.value, design: change(r.value.design) } } } }
  }
  const floating = () => changing(withFloating)

  it('an overlap is fixed by rule, without asking the model again', async () => {
    const state = await initialBookcase(setup(changing(withOverlap)))
    expect(currentDesign(state).pieces.some((p) => p.id === 'shelf-copy')).toBe(false)
    expect(state.trace.map((t) => t.step)).toEqual(['read', 'plan', 'reconstruct'])
    expect(state.trace[2]).toMatchObject({ outcome: 'ok', repairs: ['Quité Entrepaño copia: estaba completa dentro de Entrepaño 1.'] })
    expect(state.chat[1].text).toContain('Ajusté por mi cuenta un detalle')
  })

  it('after every attempt fails validation, keeps the last design and says what is left', async () => {
    const c = setup(floating())
    const state = await initialBookcase(c)
    expect(currentDesign(state).pieces.some((p) => p.id === 'shelf-extra')).toBe(true)
    expect(state.chat[1].text).toContain('quedaron una pieza sin apoyo')
    expect(state.chat[1].suggestions[0]).toBe('Corrige las piezas marcadas')
    const designs = state.trace.filter((t) => t.step === 'reconstruct')
    expect(designs.map((t) => t.outcome)).toEqual(['invalid', 'invalid', 'invalid'])
    expect(designs[0].errors[0].code).toBe('E_FLOATING')
  })

  it('a change that fixes the problem is applied, and one that adds a new problem is not', async () => {
    const c = setup(floating())
    const initial = await initialBookcase(c)
    const removing = { ...createSimulated(0), proposeAdjustment: async () => ({ value: { ...emptyAdjustment, summary: 'Quitar extra', operations: [{ op: 'removePiece' as const, id: 'shelf-extra' }] }, origin: { promptId: "p", provider: "x", model: "m" }, usage: {} }) }
    const fixed = await setup(removing).adjust(initial, 'Corrige las piezas marcadas', newSignal())
    expect(currentDesign(fixed).pieces.some((p) => p.id === 'shelf-extra')).toBe(false)
    expect(fixed.trace.at(-1)).toMatchObject({ step: 'adjust', outcome: 'ok', errors: [] })

    const breaking = { ...createSimulated(0), proposeAdjustment: async () => ({ value: { ...emptyAdjustment, summary: 'Mover', operations: [{ op: 'move' as const, id: 'side-left', axis: 'x' as const, at: { type: 'mm' as const, mm: -50 } }] }, origin: { promptId: "p", provider: "x", model: "m" }, usage: {} }) }
    const worse = await setup(breaking).adjust(initial, 'Mueve el lateral', newSignal())
    expect(worse.versions).toHaveLength(1)
    expect(worse.chat.at(-1)?.error).toBe(true)
  })

  it('a provider failure carries the trace so far', async () => {
    const llm: LLMProvider = { ...createSimulated(0), reconstruct: async () => Promise.reject(new Error('No se pudo conectar')) }
    await expect(initialBookcase(setup(llm))).rejects.toMatchObject({ message: 'No se pudo conectar', trace: [{ step: 'read', outcome: 'ok' }, { step: 'plan', outcome: 'ok' }, { outcome: 'failed', step: 'reconstruct' }] })
  })

  it('an unreadable answer (such as invalid JSON) goes back to be corrected instead of aborting', async () => {
    const simulated = createSimulated(0)
    const corrections: (string | undefined)[] = []
    const llm: LLMProvider = {
      ...simulated,
      planDesign: null,
      reconstruct: async (s, signal) => {
        corrections.push(s.correction?.errors[0]?.message)
        if (corrections.length === 1) throw new InvalidResponse('{"explanation": "Veo', 'The answer is not valid JSON')
        return simulated.reconstruct(s, signal)
      },
    }
    const state = await initialBookcase(setup(llm))
    expect(corrections).toEqual([undefined, 'The answer is not valid JSON'])
    expect(state.trace.filter((t) => t.step === 'reconstruct').map((t) => t.outcome)).toEqual(['unreadable', 'ok'])
  })
})

describe('photos are read once, in parallel, and not sent again', () => {
  const twoPhotos = { measures: BOOKCASE_MEASURES, photos: [{ angle: 'front', base64: 'AAA', note: 'la de abajo es puerta' }, { angle: 'side', base64: 'BBB' }], thumbnails: [], notes: 'librero' }
  const spying = (fails: (angle: string) => boolean = () => false) => {
    const simulated = createSimulated(0)
    const readings: string[] = []
    const designs: { photos: number; reading: boolean }[] = []
    const llm: LLMProvider = {
      ...simulated,
      readPhoto: async (r, signal) => {
        readings.push(`${r.photo.angle}:${r.photo.note ?? ''}`)
        if (fails(r.photo.angle)) throw new Error('sin conexión')
        return simulated.readPhoto(r, signal)
      },
      reconstruct: async (s, signal) => {
        designs.push({ photos: s.photos.length, reading: !!s.reading })
        return simulated.reconstruct(s, signal)
      },
    }
    return { llm, readings, designs }
  }

  it('reads each photo with its note and designs from the reading, without the images', async () => {
    const { llm, readings, designs } = spying()
    const state = await setup(llm).reconstruct(twoPhotos, newSignal())
    expect(readings.sort()).toEqual(['front:la de abajo es puerta', 'side:'])
    expect(designs).toEqual([{ photos: 0, reading: true }])
    expect(state.chat[0].text).toContain('Sobre la foto frente: la de abajo es puerta')
    expect(state.trace.filter((t) => t.step === 'read').map((t) => t.subject).sort()).toEqual(['Foto frente', 'Foto lateral'])
  })

  it('does not read the same photo twice in a session', async () => {
    const { llm, readings } = spying()
    const c = setup(llm)
    await c.reconstruct(twoPhotos, newSignal())
    await c.reconstruct(twoPhotos, newSignal())
    expect(readings).toHaveLength(2)
  })

  it('a photo that cannot be read is retried alone and then left out', async () => {
    const { llm, readings, designs } = spying((angle) => angle === 'side')
    await setup(llm).reconstruct(twoPhotos, newSignal())
    expect(readings.filter((l) => l.startsWith('side'))).toHaveLength(2)
    expect(designs).toEqual([{ photos: 0, reading: true }])
  })

  it('if no photo can be read, the design looks at the photos itself', async () => {
    const { llm, designs } = spying(() => true)
    await setup(llm).reconstruct(twoPhotos, newSignal())
    expect(designs).toEqual([{ photos: 2, reading: false }])
  })
})

describe('skeleton first: a cabinet is built by Knotty from its plan', () => {
  const cabinetPlan = {
    name: 'Cajonera',
    dimensions: { width: 500, height: 900, depth: 450 },
    material: 'T18',
    base: 'kick' as const,
    wallMounted: true,
    construction: DEFAULT_CONSTRUCTION,
    columns: [{ width: 1, cells: [0, 1, 2].map(() => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }],
  }
  const origin = { promptId: 'skeleton@6', provider: 'x', model: 'm' }
  const withPlan = (cabinet: typeof cabinetPlan | null, fails = false, bed: BedPlan | null = null) => {
    const simulated = createSimulated(0)
    const calls: string[] = []
    const llm: LLMProvider = {
      ...simulated,
      planDesign: async () => {
        calls.push('plan')
        if (fails) throw new Error('sin conexión')
        return { value: { explanation: 'Una cajonera de tres cajones.', cabinet, bed, table: null, questions: [], requestedPhotos: [], requirements: [], suggestions: ['Hazla más alta'] }, origin, usage: { outputTokens: 400 } }
      },
      reconstruct: async (s, signal) => {
        calls.push('design')
        return simulated.reconstruct(s, signal)
      },
    }
    return { llm, calls }
  }
  const request = (notes: string) => ({ measures: null, photos: [], thumbnails: [], notes: notes })

  it('builds the cabinet without asking for pieces, with its drawers and joints', async () => {
    const { llm, calls } = withPlan(cabinetPlan)
    const state = await setup(llm).reconstruct(request('Una cajonera de tres cajones'), newSignal())
    expect(calls).toEqual(['plan'])
    const d = currentDesign(state)
    expect(d.name).toBe('Cajonera')
    expect(new Set(d.pieces.map((p) => p.group).filter(Boolean)).size).toBe(3)
    expect(analyze(d, testCatalog).valid).toBe(true)
    expect(state.trace.map((t) => [t.step, t.outcome])).toEqual([['plan', 'ok']])
    expect(state.chat[1].suggestions).toEqual(['Hazla más alta'])
  })

  it('uses the measures the person gave over the plan', async () => {
    const { llm } = withPlan(cabinetPlan)
    const state = await setup(llm).reconstruct({ ...request('Una cajonera'), measures: { width: 600, height: 1000, depth: 500 } }, newSignal())
    expect(currentDesign(state).dimensions).toEqual({ width: 600, height: 1000, depth: 500 })
  })

  it('not a cabinet, or the skeleton fails: designs it whole', async () => {
    for (const [cabinet, fails] of [[null, false], [cabinetPlan, true]] as const) {
      const { llm, calls } = withPlan(cabinet, fails)
      await setup(llm).reconstruct(request('Un librero'), newSignal())
      expect(calls).toEqual(['plan', 'design'])
    }
  })

  it('the plan is kept with the version and rebuilds the design at once without the expert', async () => {
    const { llm, calls } = withPlan(cabinetPlan)
    const c = setup(llm)
    const initial = await c.reconstruct(request('Una cajonera de tres cajones'), newSignal())
    expect(currentPlan(initial)).toMatchObject({ since: 1, diverged: false })
    const four = { ...(currentPlan(initial).plan as CabinetPlan), columns: [{ width: 1, cells: [0, 1, 2, 3].map(() => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }] }
    const r = c.applyPlan(initial, { ...four, construction: { ...four.construction, drawerFronts: 'overlay' } })
    if (!r.ok) throw new Error(r.message)
    expect(calls).toEqual(['plan'])
    expect(new Set(currentDesign(r.state).pieces.map((p) => p.group).filter(Boolean)).size).toBe(4)
    expect(r.state.chat.at(-1)?.text).toBe('Cambié desde la ficha: frentes de cajón sobrepuestos, 4 cajones.')
    expect(r.state.versions.at(-1)).toMatchObject({ n: 2, summary: 'Ficha: frentes de cajón sobrepuestos, 4 cajones' })
    expect(currentPlan(r.state)).toMatchObject({ since: 2, diverged: false })
  })

  it('after a free-form change the plan is behind; going back to its version restores it', async () => {
    const { llm } = withPlan(cabinetPlan)
    const c = setup(llm)
    const initial = await c.reconstruct(request('Una cajonera de tres cajones'), newSignal())
    const freeform = { ...initial, versions: [...initial.versions, { ...initial.versions[0], n: 2, plan: null }], current: 2 }
    expect(currentPlan(freeform)).toMatchObject({ since: 1, diverged: true })
    expect(currentPlan(c.backToVersion(freeform, 1))).toMatchObject({ since: 3, diverged: false })
  })

  it('a plan that cannot be built is refused with the reason', async () => {
    const { llm } = withPlan(cabinetPlan)
    const c = setup(llm)
    const initial = await c.reconstruct(request('Una cajonera'), newSignal())
    const r = c.applyPlan(initial, { ...(currentPlan(initial).plan as CabinetPlan), dimensions: { width: 500, height: 3000, depth: 450 } })
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/más grandes? que la hoja\. Trasera mide 3000/) })
  })

  it('a bench skips the skeleton: it has no plan yet', async () => {
    const { llm, calls } = withPlan(cabinetPlan)
    await expect(setup(llm).reconstruct(request('Una banca para el recibidor'), newSignal())).rejects.toThrow(/modo simulado/)
    expect(calls).toEqual(['design'])
  })

  it('a desk goes through its own plan, with the measures given', async () => {
    const c = setup()
    const state = await c.reconstruct({ measures: { width: 1300, height: 750, depth: 600 }, photos: [], thumbnails: [], notes: 'Un escritorio con 3 cajones a la izquierda' }, newSignal())
    expect(currentPlan(state).plan).toMatchObject({ kind: 'table', use: 'desk', pedestal: { side: 'left', drawers: 3 } })
    const design = currentDesign(state)
    expect(design.dimensions).toEqual({ width: 1300, height: 750, depth: 600 })
    expect(design.pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(3)
  })

  it('a bed goes through its own plan and Knotty builds it, measures from the mattress', async () => {
    const bed: BedPlan = { kind: 'bed', name: 'Cama individual', mattress: 'individual', material: 'T18', height: 400, drawers: { side: 'left', count: 3, position: 'head' }, headboard: { style: 'storage', height: 1100, depth: 250, shelves: 2 } }
    const { llm, calls } = withPlan(null, false, bed)
    const state = await setup(llm).reconstruct(request('Una cama individual con cajones y cabecera librero'), newSignal())
    expect(calls).toEqual(['plan'])
    expect(currentPlan(state).plan).toMatchObject({ kind: 'bed', mattress: 'individual' })
    const design = currentDesign(state)
    expect(design.pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(3)
    expect(design.dimensions).toEqual({ width: 250 + 1900 + 20 + 18, height: 1100, depth: 1010 })
  })
})

describe('the plan stays alive: chat edits it, and free changes ride on top', () => {
  const drawers = (n: number) => ({
    name: 'Cajonera',
    dimensions: { width: 500, height: 900, depth: 450 },
    material: 'T18',
    base: 'kick' as const,
    wallMounted: true,
    construction: DEFAULT_CONSTRUCTION,
    columns: [{ width: 1, cells: Array.from({ length: n }, () => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }],
  })
  const origin = { promptId: 'x', provider: 'x', model: 'm' }
  const hanger = makePiece({ id: 'rail', name: 'Listón de colgar', role: 'brace', material: 'T18', normal: 'z', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: extent(null, ref('top.y0'), 80), z: startAt(ref('back.z1')) })
  const expert = (adjust: Partial<PlanAdjustment> | null, operations: Operation[] = []) => {
    const simulated = createSimulated(0)
    const calls: string[] = []
    const llm: LLMProvider = {
      ...simulated,
      planDesign: async () => ({ value: { explanation: 'Cajonera.', cabinet: drawers(3), bed: null, table: null, questions: [], requestedPhotos: [], requirements: [], suggestions: [] }, origin, usage: {} }),
      adjustPlan: adjust
        ? async () => {
            calls.push('plan')
            return { value: { explanation: 'Listo.', summary: 'Cambio', action: 'plan', cabinet: null, bed: null, table: null, questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], ...adjust }, origin, usage: {} }
          }
        : null,
      proposeAdjustment: async () => {
        calls.push('pieces')
        return { value: { ...emptyAdjustment, summary: 'Agregar listón', operations }, origin, usage: {} }
      },
    }
    return { llm, calls }
  }
  const start = async (llm: LLMProvider) => {
    const c = setup(llm)
    return { c, initial: await c.reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Una cajonera' }, newSignal()) }
  }

  it('a change the plan can express comes back as a new plan, with no pieces asked', async () => {
    const { llm, calls } = expert({ action: 'plan', cabinet: drawers(4), summary: 'Agregar un cajón' })
    const { c, initial } = await start(llm)
    const state = await c.adjust(initial, 'Ponle un cajón más', newSignal())
    expect(calls).toEqual(['plan'])
    expect(currentPlan(state)).toMatchObject({ since: 2, diverged: false })
    expect(new Set(currentDesign(state).pieces.map((p) => p.group).filter(Boolean)).size).toBe(4)
  })

  it('a question gets an answer and no new version', async () => {
    const { llm, calls } = expert({ action: 'answer', explanation: 'Las correderas son de 40 cm.' })
    const { c, initial } = await start(llm)
    const state = await c.adjust(initial, '¿De qué largo son las correderas?', newSignal())
    expect(calls).toEqual(['plan'])
    expect(state.versions).toHaveLength(1)
    expect(state.chat.at(-1)?.text).toBe('Las correderas son de 40 cm.')
  })

  it('what the plan cannot express goes piece by piece and rides on top as an extra that survives the plan', async () => {
    const { llm, calls } = expert({ action: 'freeform' }, [{ op: 'addPiece', piece: hanger }])
    const { c, initial } = await start(llm)
    const withRail = await c.adjust(initial, 'Ponle un listón para colgarla', newSignal())
    expect(calls).toEqual(['plan', 'pieces'])
    expect(currentPlan(withRail)).toMatchObject({ diverged: false, extras: [{ op: 'addPiece' }] })
    const r = c.applyPlan(withRail, { kind: 'cabinet', ...drawers(3), dimensions: { width: 600, height: 900, depth: 450 } })
    if (!r.ok) throw new Error(r.message)
    expect(currentDesign(r.state).pieces.some((p) => p.id === 'rail')).toBe(true)
    expect(analyze(currentDesign(r.state), testCatalog).valid).toBe(true)
  })

  it('an extra that no longer applies to the new plan is left out, and said', async () => {
    const { llm } = expert({ action: 'freeform' }, [{ op: 'removeGroup', group: 'drawer-3' }])
    const { c, initial } = await start(llm)
    const withoutThird = await c.adjust(initial, 'Quita el cajón de arriba y deja el hueco', newSignal())
    const r = c.applyPlan(withoutThird, { kind: 'cabinet', ...drawers(2) })
    if (!r.ok) throw new Error(r.message)
    expect(r.notes.join(' ')).toContain('ya no aplica')
    expect(currentPlan(r.state).extras).toEqual([])
  })

  it('a plan that cannot be built falls back to pieces', async () => {
    const { llm, calls } = expert({ action: 'plan', cabinet: { ...drawers(3), dimensions: { width: 500, height: 3000, depth: 450 } } }, [{ op: 'addPiece', piece: hanger }])
    const { c, initial } = await start(llm)
    await c.adjust(initial, 'Hazla de 3 metros', newSignal())
    expect(calls).toEqual(['plan', 'pieces'])
  })
})

describe('editing a piece by hand, without the expert', () => {
  const box = (state: DesignState, id: string) => {
    const a = analyze(currentDesign(state), testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return a.geo.boxes.get(id)!
  }
  const start = () => {
    const c = setup()
    return { c, initial: c.fromExample(exampleBookcase) }
  }

  it('moves a shelf and changes its thickness, each in one version', () => {
    const { c, initial } = start()
    const moved = c.editPiece(initial, 'shelf-1', { kind: 'move', axis: 'y', delta: 50 })
    if (!moved.ok) throw new Error(moved.message)
    expect(box(moved.state, 'shelf-1').y0).toBe(box(initial, 'shelf-1').y0 + 50)
    expect(moved.state.chat.at(-1)?.text).toBe('Cambié a mano: Mover entrepaño 1 50 mm.')
    const thinner = c.editPiece(moved.state, 'shelf-1', { kind: 'thickness', material: 'T15' })
    if (!thinner.ok) throw new Error(thinner.message)
    expect(box(thinner.state, 'shelf-1').y1 - box(thinner.state, 'shelf-1').y0).toBe(15)
    expect(thinner.state.versions.map((v) => v.n)).toEqual([1, 2, 3])
  })

  it('a shelf longer than its opening is refused, and widening the whole piece is offered', () => {
    const { c, initial } = start()
    const r = c.editPiece(initial, 'shelf-1', { kind: 'length', axis: 'x', value: 700 })
    expect(r).toMatchObject({ ok: false, alternatives: [{ axis: 'x', value: 736, label: 'Cambiar el ancho del mueble en +136 mm' }] })
    if (r.ok) return
    const wider = c.resizeFurniture(initial, 'x', r.alternatives[0].value)
    if (!wider.ok) throw new Error(wider.message)
    expect(currentDesign(wider.state).dimensions.width).toBe(736)
    expect(box(wider.state, 'shelf-1').x1 - box(wider.state, 'shelf-1').x0).toBe(700)
  })

  it('on a design with a plan, the hand edit rides on top as an extra, and widening goes through the plan', async () => {
    const plan = { name: 'Librero', dimensions: { width: 600, height: 1800, depth: 300 }, material: 'T18', base: 'kick' as const, wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'open' as const, shelves: 3, doors: null }] }] }
    const simulated = createSimulated(0)
    const c = setup({ ...simulated, planDesign: async () => ({ value: { explanation: 'Librero.', cabinet: plan, bed: null, table: null, questions: [], requestedPhotos: [], requirements: [], suggestions: [] }, origin: { promptId: 'x', provider: 'x', model: 'm' }, usage: {} }) })
    const initial = await c.reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Un librero' }, newSignal())
    const moved = c.editPiece(initial, 'c1-h1-shelf-1', { kind: 'move', axis: 'y', delta: 40 })
    if (!moved.ok) throw new Error(moved.message)
    expect(currentPlan(moved.state)).toMatchObject({ diverged: false, extras: [{ op: 'move', id: 'c1-h1-shelf-1' }] })
    const wider = c.resizeFurniture(moved.state, 'x', 800)
    if (!wider.ok) throw new Error(wider.message)
    expect((currentPlan(wider.state).plan as CabinetPlan).dimensions.width).toBe(800)
    expect(currentPlan(wider.state).extras).toHaveLength(1)
  })
})

describe('trust: nothing structural goes unasked, and any change can be undone in parts', () => {
  const answering = (value: Partial<AdjustmentResponse>) => {
    const simulated = createSimulated(0)
    return setup({ ...simulated, proposeAdjustment: async () => ({ value: { ...emptyAdjustment, summary: 'Cambio', ...value }, origin: { promptId: 'x', provider: 'x', model: 'm' }, usage: {} }) })
  }
  const removeKick: Operation[] = [{ op: 'removePiece', id: 'kick' }]

  it('taking away structure that was not asked for waits for the person, and one click applies it', () => {
    const c = answering({ operations: removeKick })
    return c.adjust(c.fromExample(exampleBookcase), 'Hazlo más ligero', newSignal()).then((state) => {
      expect(state.versions).toHaveLength(1)
      expect(state.proposal?.holds[0]).toMatch(/^Quiere quitar Zoclo/)
      const applied = c.applyProposal(state)
      expect(currentDesign(applied).pieces.some((p) => p.id === 'kick')).toBe(false)
    })
  })

  it('when the person asks to remove it, it just happens', async () => {
    const c = answering({ operations: removeKick })
    const state = await c.adjust(c.fromExample(exampleBookcase), 'Quita el zoclo', newSignal())
    expect(state.versions).toHaveLength(2)
  })

  it('changes that come with questions wait for the answers', async () => {
    const c = answering({ operations: [{ op: 'changeMaterial', ids: ['shelf-1'], material: 'T15' }], questions: [{ text: '¿Cuánto peso?', options: ['Poco', 'Mucho'] }] })
    const state = await c.adjust(c.fromExample(exampleBookcase), 'Adelgaza la repisa', newSignal())
    expect(state.versions).toHaveLength(1)
    expect(state.proposal?.holds).toEqual(['Hizo preguntas: el cambio espera tus respuestas.'])
  })

  it('brings back one piece from before an older change, and undoes a whole change', () => {
    const c = setup()
    const initial = c.fromExample(exampleBookcase)
    const thinner = c.editPiece(initial, 'shelf-2', { kind: 'thickness', material: 'T15' })
    if (!thinner.ok) throw new Error(thinner.message)
    const moved = c.editPiece(thinner.state, 'shelf-1', { kind: 'move', axis: 'y', delta: 30 })
    if (!moved.ok) throw new Error(moved.message)
    const restored = c.restoreFromVersion(moved.state, 2, ['shelf-2'])
    if (!restored.ok) throw new Error(restored.message)
    const d = currentDesign(restored.state)
    expect(d.pieces.find((p) => p.id === 'shelf-2')?.material).toBe('T18')
    expect(restored.state.chat.at(-1)?.text).toBe('Regresé Entrepaño 2 como estaba antes de la v2.')
    const undone = c.undoChange(restored.state, restored.state.current)
    if (!undone.ok) throw new Error(undone.message)
    expect(currentDesign(undone.state).pieces.find((p) => p.id === 'shelf-2')?.material).toBe('T15')
  })
})

describe('notices: one place for what waits for a decision', () => {
  const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }

  it('a finding is pending until it is fixed by Knotty (and then shows as resolved) or accepted as it is', () => {
    const c = setup()
    const initial = c.fromExample(wide)
    const board = noticeBoard(initial, testCatalog)
    const sag = board.pending.find((n) => n.title === 'Entrepaños que se pandean')!
    expect(sag).toBeTruthy()
    // Every finding notice is titled by its rule in the registry.
    for (const n of board.pending.filter((n) => n.kind === 'finding')) expect(n.title).toBe(ruleTitle(n.findings[0].code))

    const accepted = c.acceptNotice(initial, sag.findings, sag.title)
    expect(noticeBoard(accepted, testCatalog).pending.some((n) => n.key === sag.key)).toBe(false)
    expect(noticeBoard(accepted, testCatalog).accepted.map((n) => n.key)).toContain(sag.key)
    expect(noticeBoard(c.reopenNotice(accepted, sag.findings), testCatalog).pending.some((n) => n.key === sag.key)).toBe(true)

    const fix = fixesFor(currentDesign(initial), testCatalog, sag.findings[0]).find((f) => f.key === 'center-divider')!
    const resolved = c.applyFix(initial, fix)
    expect(resolved.chat.at(-1)?.text).toBe(`Resolví: ${fix.label}.`)
    const piece = currentDesign(initial).pieces.find((p) => p.id === sag.findings[0].pieces[0])!.name
    expect(noticeBoard(resolved, testCatalog).resolved).toContain(`Entrepaños que se pandean: ${piece}`)
  })

  it('what the person accepted is not a failure in the verdict, but it is said', async () => {
    const c = setup()
    const initial = c.fromExample({ ...exampleBookcase, wallAnchored: false })
    const tipping = noticeBoard(initial, testCatalog).pending.find((n) => n.title === 'Riesgo de vuelco')!
    const accepted = c.acceptNotice(initial, tipping.findings, tipping.title)
    const verdict = await c.reviewPurchase(accepted, testCatalog, newSignal())
    expect(verdict.checks.find((x) => x.id === 'accepted')?.detail).toBe('Lo dejaste así, bajo tu riesgo: Riesgo de vuelco.')
  })

  it('two checks of one rule on the same pieces are accepted apart: leaving the wall cabinet unanchored does not drop its hanging rail', () => {
    const c = setup()
    const initial = c.fromExample({ ...exampleWallCabinet, wallAnchored: false })
    const use = analyze(currentDesign(initial), testCatalog)
    const [anchor, rail] = ['wall-cabinet.anchor', 'wall-cabinet.hanging-rail'].map((check) => use.valid && use.findings.find((h) => h.code === 'R10_USE' && h.check === check))
    expect(anchor && rail && findingKey(anchor) !== findingKey(rail)).toBe(true)

    const pending = () => noticeBoard(initial, testCatalog).pending.filter((n) => n.title === 'Uso del mueble')
    const [critical, recommendation] = [...pending()].sort((a, b) => a.severity.localeCompare(b.severity))
    expect([critical.severity, recommendation.severity]).toEqual(['critical', 'recommendation'])
    const accepted = c.acceptNotice(initial, critical.findings, critical.title)
    const board = noticeBoard(accepted, testCatalog)
    expect(board.accepted.map((n) => n.key)).toEqual([critical.key])
    expect(board.pending.map((n) => n.key)).toContain(recommendation.key)
  })

  it('a key saved before checks had ids (R10_USE:) hides neither finding: both show again once', () => {
    const c = setup()
    const initial = c.fromExample({ ...exampleWallCabinet, wallAnchored: false })
    const legacy = { ...initial, accepted: [{ key: 'R10_USE:', title: 'Uso del mueble', at: '2026-09-01T10:00:00Z' }] }
    expect(noticeBoard(legacy, testCatalog).pending.filter((n) => n.title === 'Uso del mueble')).toHaveLength(2)
  })

  it("the expert's pending proposal and unanswered questions are notices too", async () => {
    const initial = await initialBookcase(setup())
    const board = noticeBoard(initial, testCatalog)
    expect(board.pending.filter((n) => n.kind === 'question').map((n) => n.message)).toContain('¿Qué vas a guardar principalmente?')
  })
})

describe('the tray: decisions for the expert go in one request', () => {
  it('sends answers and notices together, marks the questions answered and empties the tray', async () => {
    const c = setup()
    const initial = await initialBookcase(c)
    const expert = initial.chat[1]
    const [question] = expert.questions
    let state = c.toggleTray(initial, answerItem(expert.id, 0, question.text, question.options![0]))
    state = c.toggleTray(state, suggestionItem('Refuerza la base'))
    expect(c.repository.state?.tray).toHaveLength(2)
    const sent = await c.sendTray(state, 'Y hazlo de 80 cm de ancho', newSignal())
    const request = sent.chat.filter((m) => m.author === 'user').at(-1)!
    expect(request.text).toBe(`Te mando todo junto:\n1. ${question.text} ${question.options![0]}\n2. Refuerza la base\n3. Y hazlo de 80 cm de ancho`)
    expect(sent.chat.find((m) => m.id === expert.id)!.answers).toContain('p0')
    expect(sent.tray).toEqual([])
  })
})
