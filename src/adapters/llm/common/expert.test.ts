import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { testCatalog } from '../../../domain/furniture/fixtures/catalog.test-util'
import { exampleBookcase } from '../../../domain/furniture/fixtures/bookcase'
import { answerWith, expertPlans, PlanAdjustment, planAdjustmentFor, AdjustmentResponse, ReviewResponse, InvalidResponse, PlanResponse, ReconstructionResponse } from '../../../ports/LLMProvider'
import { DEFAULT_CONSTRUCTION } from '../../../domain/furniture/modules/cabinet'
import { FURNITURE_KINDS, MODULES } from '../../../domain/furniture/modules/plan'
import { PhotoReading } from '../../../domain/furniture/reading/reading'
import { strictSchema } from './jsonSchema'
import { createExpert, type Content, type Transport } from './expert'
import { ADJUSTMENT, PURCHASE_REVIEW, READING, RECONSTRUCTION, systemFor } from './prompts'

function walk(node: unknown, visit: (n: Record<string, unknown>) => void) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit))
  if (!node || typeof node !== 'object') return
  visit(node as Record<string, unknown>)
  Object.values(node).forEach((v) => walk(v, visit))
}

describe('strictSchema', () => {
  it.each([AdjustmentResponse, ReviewResponse, PhotoReading, PlanResponse, PlanAdjustment, ReconstructionResponse, ...FURNITURE_KINDS.map(planAdjustmentFor)] as z.ZodType[])('leaves a schema the strict modes accept', (schema) => {
    const objects: Record<string, unknown>[] = []
    walk(strictSchema(schema), (n) => {
      for (const forbidden of ['oneOf', 'pattern', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'const', '$schema']) expect(n).not.toHaveProperty(forbidden)
      if (n.type === 'object' && n.properties) objects.push(n)
    })
    for (const n of objects) {
      expect(n.additionalProperties).toBe(false)
      expect(n.required).toEqual(Object.keys(n.properties as object))
    }
  })
})

describe('prompts', () => {
  // The system prompt travels with every call: if it suddenly grows, something slipped in (a huge catalog, for instance).
  it.each([RECONSTRUCTION, ADJUSTMENT, PURCHASE_REVIEW, READING])('the system prompt of $id stays small', (task) => {
    expect(new TextEncoder().encode(systemFor(task, testCatalog)).length).toBeLessThan(64 * 1024)
  })
})

describe('createExpert', () => {
  const fake = (json: unknown) => {
    const calls: { system: string; content: Content[]; schema: Record<string, unknown> }[] = []
    const t: Transport = {
      provider: 'test',
      model: 'm',
      async completeJSON(system, content, schema) {
        calls.push({ system, content, schema })
        return { json, usage: {} }
      },
    }
    return { expert: createExpert(t, 'Test'), calls }
  }

  describe('the space the person has', () => {
    const ask = async (request: { measures: typeof exampleBookcase.dimensions | null; space?: { width?: number; height?: number; depth?: number } | null }) => {
      const { expert, calls } = fake({ explanation: 'x', design: exampleBookcase, questions: [], requirements: [], suggestions: [] })
      await expert.reconstruct({ photos: [], notes: 'un librero', reading: null, catalog: testCatalog, correction: null, ...request }, new AbortController().signal)
      return (calls[0].content[0] as { text: string }).text
    }

    it('goes as a limit with only the sides that were filled in', async () => {
      const text = await ask({ measures: null, space: { width: 1200, height: 2000 } })
      expect(text).toContain('width up to 1200 mm, height up to 2000 mm')
      expect(text).not.toContain('depth up to')
      expect(text).toContain('must fit inside it')
    })

    it.each([[undefined], [null], [{}]])('says nothing about a space when there is none (%j)', async (space) => {
      expect(await ask({ measures: null, space })).not.toContain('space they have')
    })

    it('never competes with exact measures', async () => {
      expect(await ask({ measures: exampleBookcase.dimensions, space: { width: 1200 } })).not.toContain('space they have')
    })
  })

  it('sends measures, the view the person chose and images, with the catalog in the system prompt', async () => {
    const { expert, calls } = fake({ explanation: 'x', design: exampleBookcase, questions: [], requirements: [], suggestions: [] })
    const r = await expert.reconstruct({ measures: exampleBookcase.dimensions, photos: [{ base64: 'AAA', view: 'front' }], notes: 'para libros', reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
    expect(r.origin.promptId).toBe('system@12+reconstruction@14')
    expect(calls[0].system).toContain('T18: Triplay de pino 18 mm')
    expect(calls[0].content).toEqual([
      { kind: 'text', text: 'Furniture measures: width 550 mm, height 1800 mm, depth 300 mm.\nThe person\'s notes: para libros' },
      { kind: 'text', text: 'Photo 1: front' },
      { kind: 'image', base64: 'AAA' },
    ])
  })

  it('without photos it sends the description and tells the expert to design from it', async () => {
    const { expert, calls } = fake({ explanation: 'x', design: exampleBookcase, questions: [], requirements: [], suggestions: [] })
    await expert.reconstruct({ measures: exampleBookcase.dimensions, photos: [], notes: 'librero de 5 repisas', reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(calls[0].content).toEqual([{ kind: 'text', text: expect.stringContaining('There are no photos: design from this description') }])
    expect(calls[0].content[0]).toMatchObject({ text: expect.stringContaining('Description: librero de 5 repisas') })
  })

  it('the purchase review sends the context with the review and uses the carpenter prompt', async () => {
    const { expert, calls } = fake({ verdict: 'needs-changes', summary: 'Sube la repisa', problems: [], tips: ['Mide el espesor'] })
    const r = await expert.reviewPurchase({ context: '## Diseño', review: '## Lista de corte', design: exampleBookcase, checks: [], catalog: testCatalog }, new AbortController().signal)
    expect(r.value.verdict).toBe('needs-changes')
    expect(r.origin.promptId).toBe('system@12+review@5')
    expect(calls[0].system).toContain('review before buying')
    expect(calls[0].content).toEqual([{ kind: 'text', text: '## Diseño\n\n## Lista de corte' }])
  })

  it('reads a photo with its own short prompt, its note and the person context', async () => {
    const { expert, calls } = fake({ view: 'front', kind: 'librero', confidence: 'high', description: 'Un librero', proportions: null, base: 'kick', topOverhangs: null, columns: null, details: [], doubts: [] })
    const r = await expert.readPhoto({ photo: { base64: 'AAA', note: 'la de abajo es puerta' }, context: 'librero para libros' }, new AbortController().signal)
    expect(r.value.base).toBe('kick')
    expect(r.origin.promptId).toBe('reading@4')
    expect(calls[0].system).toContain('main piece of furniture')
    expect(calls[0].system).not.toContain('T18')
    expect(calls[0].content).toEqual([
      { kind: 'text', text: 'The person says about this photo: la de abajo es puerta\nWhat the person is after: librero para libros' },
      { kind: 'image', base64: 'AAA' },
    ])
  })

  it('with a reading, the design request carries it and no images', async () => {
    const { expert, calls } = fake({ explanation: 'x', design: exampleBookcase, questions: [], requirements: [], suggestions: [] })
    const reading = { view: 'front' as const, kind: 'librero', confidence: 'high' as const, description: 'Un librero', proportions: null, base: null, topOverhangs: null, columns: null, details: [], doubts: [] }
    await expert.reconstruct({ measures: exampleBookcase.dimensions, photos: [], notes: '', reading, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(calls[0].content).toHaveLength(1)
    expect(calls[0].content[0]).toMatchObject({ text: expect.stringContaining('The photos are not attached: they were already read') })
  })

  it('asks for the skeleton with its own short prompt and the board thicknesses of the catalog', async () => {
    const { expert, calls } = fake({ explanation: 'x', ...answerWith(null), questions: [], requirements: [], suggestions: [] })
    const r = await expert.planDesign!({ measures: null, photos: [], notes: 'una cama', reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(r.value.cabinet).toBeNull()
    expect(r.origin.promptId).toBe('skeleton@16+all')
    expect(calls[0].system).toContain('"T18" (18 mm)')
    expect(calls[0].system).not.toContain('{{materials}}')
    expect(calls[0].content[0]).not.toMatchObject({ text: expect.stringContaining('The person chose') })
  })

  it('the design request says what the person chose the furniture is', async () => {
    const { expert, calls } = fake({ explanation: 'x', ...answerWith(null), questions: [], requirements: [], suggestions: [] })
    await expert.planDesign!({ measures: null, photos: [], notes: 'para la sala', reading: null, catalog: testCatalog, correction: null, kind: 'tvStand' }, new AbortController().signal)
    expect(calls[0].content[0]).toMatchObject({ text: expect.stringContaining('The person chose what this furniture is: un mueble de TV (tvStand).') })
  })

  it('edits the plan with its own short prompt: the context, the current plan and the request', async () => {
    const { expert, calls } = fake({ explanation: 'x', summary: 'r', action: 'answer', ...answerWith(null), questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] })
    const plan = { kind: 'cabinet' as const, name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, material: 'T18', base: 'floor' as const, legHeight: 150, wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [] }
    const r = await expert.adjustPlan!({ context: '## Diseño', request: '¿Aguanta?', plan, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(r.origin.promptId).toBe('plan-adjust@13+cabinet@8')
    expect(calls[0].system).toContain('"T15" (15 mm)')
    expect(calls[0].content[0]).toMatchObject({ text: expect.stringMatching(/## Diseño[\s\S]*## Current plan\n\{"kind":"cabinet","name":"Buró"[\s\S]*## The person's request\n¿Aguanta\?/) })
  })

  it('adjusting a plan asks only for its own module, and the answer reads with every other module null', async () => {
    const bed = MODULES.bed.benchVariants()[0][1]
    const { expert, calls } = fake({ explanation: 'x', summary: 'Subir la base', action: 'plan', bed: { ...bed, height: 450 }, questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] })
    const r = await expert.adjustPlan!({ context: '', request: 'Súbela a 45 cm', plan: bed, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(Object.keys(calls[0].schema.properties as object)).toEqual(['explanation', 'summary', 'action', 'bed', 'questions', 'suggestions', 'requirements', 'decisions'])
    expect(calls[0].system).toContain('goes in `bed`')
    expect(calls[0].system).not.toContain('goes in `cabinet`')
    expect(r.origin.promptId).toBe('plan-adjust@13+bed@3')
    expect(expertPlans(r.value)).toEqual({ bed: { ...bed, height: 450 }, cabinet: null, table: null, shoeRack: null })
  })

  it('a known use with a guide adds it: the skeleton and the plan adjustment say so in their id', async () => {
    const skeleton = fake({ explanation: 'x', ...answerWith(null), questions: [], requirements: [], suggestions: [] }).expert
    const designed = await skeleton.planDesign!({ measures: null, photos: [], notes: 'aparador', reading: null, catalog: testCatalog, correction: null, routeKind: 'sideboard' }, new AbortController().signal)
    expect(designed.origin.promptId).toBe('skeleton@16+cabinet@8+sideboard@3')
    const { expert } = fake({ explanation: 'x', ...answerWith(null), summary: 'r', action: 'answer', questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] })
    const plan = { kind: 'cabinet' as const, name: 'Aparador', dimensions: { width: 1600, height: 940, depth: 400 }, material: 'T18', base: 'kick' as const, legHeight: 150, wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [] }
    const adjusted = await expert.adjustPlan!({ context: '', request: 'x', plan, kind: 'sideboard', catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(adjusted.origin.promptId).toBe('plan-adjust@13+cabinet@8+sideboard@3')
  })

  it('the plan correction round carries the previous plan and why it did not build', async () => {
    const { expert, calls } = fake({ explanation: 'x', summary: 'r', action: 'answer', ...answerWith(null), questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] })
    const plan = { kind: 'cabinet' as const, name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, material: 'T18', base: 'floor' as const, legHeight: 150, wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [] }
    await expert.adjustPlan!({ context: '', request: 'x', plan, catalog: testCatalog, correction: { previousResponse: { action: 'plan' }, errors: '- E_X: no cabe' } }, new AbortController().signal)
    expect(calls[0].content[1]).toMatchObject({ text: expect.stringMatching(/## Your previous answer could not be used\n- E_X: no cabe[\s\S]*"action":"plan"/) })
  })

  it('a knowledge selection adds the craft blocks to the prompt id of every call, and none leaves it as it was', async () => {
    const knowledge = { core: 'short' as const, guide: null, guideSize: 'short' as const, tools: 2 as const }
    const state = { measures: null, photos: [], notes: 'x', reading: null, catalog: testCatalog, correction: null, knowledge }
    const review = fake({ verdict: 'needs-changes', summary: 's', problems: [], tips: ['t'] }).expert
    expect((await review.reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog, knowledge }, new AbortController().signal)).origin.promptId).toBe('system@12+review@5+core@2+tools@1')
    const skeleton = fake({ explanation: 'x', ...answerWith(null), questions: [], requirements: [], suggestions: [] }).expert
    expect((await skeleton.planDesign!(state, new AbortController().signal)).origin.promptId).toBe('skeleton@16+all+core@2+tools@1')
    const photo = fake({ view: 'front', kind: 'librero', confidence: 'high', description: 'Un librero', proportions: null, base: 'kick', topOverhangs: null, columns: null, details: [], doubts: [] }).expert
    expect((await photo.readPhoto({ photo: { base64: 'AAA' }, context: '', knowledge }, new AbortController().signal)).origin.promptId).toBe('reading@4+core@2')
  })

  it('an answer that does not match the schema throws InvalidResponse with the problems', async () => {
    const { expert } = fake({ explanation: 'x', operations: [{ op: 'volar' }] })
    const promise = expert.proposeAdjustment({ context: '', request: 'x', design: exampleBookcase, proposal: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    await expect(promise).rejects.toBeInstanceOf(InvalidResponse)
    await expect(promise).rejects.toMatchObject({ problems: expect.stringContaining('summary') })
  })
})
