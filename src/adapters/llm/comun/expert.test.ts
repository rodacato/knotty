import { describe, expect, it } from 'vitest'
import { testCatalog } from '../../../domain/fixtures/catalog.test-util'
import { exampleBookcase } from '../../../domain/fixtures/bookcase'
import { PlanAdjustment, AdjustmentResponse, ReviewResponse, InvalidResponse, PlanResponse } from '../../../ports/LLMProvider'
import { DEFAULT_CONSTRUCTION } from '../../../domain/modules/cabinet'
import { PhotoReading } from '../../../domain/reading/reading'
import { strictSchema } from './jsonSchema'
import { createExpert, type Content, type Transport } from './expert'
import { ADJUSTMENT, PURCHASE_REVIEW, READING, RECONSTRUCTION, systemFor } from './prompts'

function recorrer(nodo: unknown, visitar: (n: Record<string, unknown>) => void) {
  if (Array.isArray(nodo)) return nodo.forEach((n) => recorrer(n, visitar))
  if (!nodo || typeof nodo !== 'object') return
  visitar(nodo as Record<string, unknown>)
  Object.values(nodo).forEach((v) => recorrer(v, visitar))
}

describe('strictSchema', () => {
  it.each([AdjustmentResponse, ReviewResponse, PhotoReading, PlanResponse, PlanAdjustment])('leaves a schema the strict modes accept', (tipo) => {
    recorrer(strictSchema(tipo), (n) => {
      for (const prohibida of ['oneOf', 'pattern', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'const', '$schema']) expect(n).not.toHaveProperty(prohibida)
      if (n.type === 'object' && n.properties) {
        expect(n.additionalProperties).toBe(false)
        expect(n.required).toEqual(Object.keys(n.properties as object))
      }
    })
  })
})

describe('prompts', () => {
  // El sistema viaja en cada llamada: si crece de golpe, algo se coló (por ejemplo, un catálogo enorme).
  it.each([RECONSTRUCTION, ADJUSTMENT, PURCHASE_REVIEW, READING])('the system prompt of $id stays small', (tarea) => {
    expect(new TextEncoder().encode(systemFor(tarea, testCatalog)).length).toBeLessThan(64 * 1024)
  })
})

describe('createExpert', () => {
  const falso = (json: unknown) => {
    const llamadas: { sistema: string; contenido: Content[] }[] = []
    const t: Transport = {
      provider: 'prueba',
      model: 'm',
      async completeJSON(sistema, contenido) {
        llamadas.push({ sistema, contenido })
        return { json, usage: {} }
      },
    }
    return { experto: createExpert(t, 'Prueba'), llamadas }
  }

  it('sends measures, angle labels and images, with the catalog in the system prompt', async () => {
    const { experto, llamadas } = falso({ explanation: 'x', design: exampleBookcase, questions: [], requestedPhotos: [], requirements: [], suggestions: [] })
    const r = await experto.reconstruct({ measures: exampleBookcase.dimensions, photos: [{ angle: 'front', base64: 'AAA' }], notes: 'para libros', reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
    expect(r.origin.promptId).toBe('sistema@6+reconstruccion@9')
    expect(llamadas[0].sistema).toContain('T18: Triplay de pino 18 mm')
    expect(llamadas[0].contenido).toEqual([
      { kind: 'texto', text: 'Furniture measures: width 600 mm, height 1800 mm, depth 300 mm.\nThe person\'s notes: para libros' },
      { kind: 'texto', text: 'Photo 1: front' },
      { kind: 'imagen', base64: 'AAA' },
    ])
  })

  it('without photos it sends the description and tells the expert to design from it', async () => {
    const { experto, llamadas } = falso({ explanation: 'x', design: exampleBookcase, questions: [], requestedPhotos: [], requirements: [], suggestions: [] })
    await experto.reconstruct({ measures: exampleBookcase.dimensions, photos: [], notes: 'librero de 5 repisas', reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(llamadas[0].contenido).toEqual([{ kind: 'texto', text: expect.stringContaining('There are no photos: design from this description') }])
    expect(llamadas[0].contenido[0]).toMatchObject({ text: expect.stringContaining('Description: librero de 5 repisas') })
  })

  it('the purchase review sends the context with the review and uses the carpenter prompt', async () => {
    const { experto, llamadas } = falso({ verdict: 'needs-changes', summary: 'Sube la repisa', problems: [], tips: ['Mide el espesor'] })
    const r = await experto.reviewPurchase({ context: '## Diseño', review: '## Lista de corte', design: exampleBookcase, checks: [], catalog: testCatalog }, new AbortController().signal)
    expect(r.value.verdict).toBe('needs-changes')
    expect(r.origin.promptId).toBe('sistema@6+dictamen@3')
    expect(llamadas[0].sistema).toContain('review before buying')
    expect(llamadas[0].contenido).toEqual([{ kind: 'texto', text: '## Diseño\n\n## Lista de corte' }])
  })

  it('reads a photo with its own short prompt, its note and the person context', async () => {
    const { experto, llamadas } = falso({ kind: 'librero', confidence: 'high', description: 'Un librero', proportions: null, base: 'kick', topOverhangs: null, columns: null, details: [], doubts: [] })
    const r = await experto.readPhoto({ photo: { angle: 'front', base64: 'AAA', note: 'la de abajo es puerta' }, context: 'librero para libros' }, new AbortController().signal)
    expect(r.value.base).toBe('kick')
    expect(r.origin.promptId).toBe('lectura@2')
    expect(llamadas[0].sistema).toContain('main piece of furniture')
    expect(llamadas[0].sistema).not.toContain('T18')
    expect(llamadas[0].contenido).toEqual([
      { kind: 'texto', text: 'Photo: front. The person says about this photo: la de abajo es puerta\nWhat the person is after: librero para libros' },
      { kind: 'imagen', base64: 'AAA' },
    ])
  })

  it('with a reading, the design request carries it and no images', async () => {
    const { experto, llamadas } = falso({ explanation: 'x', design: exampleBookcase, questions: [], requestedPhotos: [], requirements: [], suggestions: [] })
    const lectura = { kind: 'librero', confidence: 'high' as const, description: 'Un librero', proportions: null, base: null, topOverhangs: null, columns: null, details: [], doubts: [] }
    await experto.reconstruct({ measures: exampleBookcase.dimensions, photos: [], notes: '', reading: lectura, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(llamadas[0].contenido).toHaveLength(1)
    expect(llamadas[0].contenido[0]).toMatchObject({ text: expect.stringContaining('The photos are not attached: they were already read') })
  })

  it('asks for the skeleton with its own short prompt and the board thicknesses of the catalog', async () => {
    const { experto, llamadas } = falso({ explanation: 'x', cabinet: null, bed: null, table: null, questions: [], requestedPhotos: [], requirements: [], suggestions: [] })
    const r = await experto.planDesign!({ measures: null, photos: [], notes: 'una cama', reading: null, catalog: testCatalog, correction: null }, new AbortController().signal)
    expect(r.value.cabinet).toBeNull()
    expect(r.origin.promptId).toBe('esqueleto@7')
    expect(llamadas[0].sistema).toContain('"T18" (18 mm)')
    expect(llamadas[0].sistema).not.toContain('{{materiales}}')
  })

  it('edits the ficha with its own short prompt: the context, the current plan and the request', async () => {
    const { experto, llamadas } = falso({ explanation: 'x', summary: 'r', action: 'answer', cabinet: null, bed: null, table: null, questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [] })
    const plan = { name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, material: 'T18', base: 'floor' as const, wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [] }
    const r = await experto.adjustPlan!({ context: '## Diseño', request: '¿Aguanta?', plan, catalog: testCatalog }, new AbortController().signal)
    expect(r.origin.promptId).toBe('ajuste-ficha@5')
    expect(llamadas[0].sistema).toContain('"T15" (15 mm)')
    expect(llamadas[0].contenido[0]).toMatchObject({ text: expect.stringMatching(/## Diseño[\s\S]*## Current ficha\n\{"name":"Buró"[\s\S]*## The person's request\n¿Aguanta\?/) })
  })

  it('an answer that does not match the schema throws InvalidResponse with the problems', async () => {
    const { experto } = falso({ explanation: 'x', operations: [{ op: 'volar' }] })
    const promesa = experto.proposeAdjustment({ context: '', request: 'x', design: exampleBookcase, proposal: null, photos: [], catalog: testCatalog, correction: null }, new AbortController().signal)
    await expect(promesa).rejects.toBeInstanceOf(InvalidResponse)
    await expect(promesa).rejects.toMatchObject({ problems: expect.stringContaining('summary') })
  })
})
