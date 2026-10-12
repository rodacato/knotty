import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createAbsent } from '../../adapters/llm/absent/absent'
import { analyze } from '../../domain/checks/analysis'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { exampleWallCabinet } from '../../domain/furniture/fixtures/wallCabinet'
import { exampleSideboard } from '../../domain/furniture/fixtures/references.test-util'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { currentDesign, DesignState, type PurchaseReview } from '../../domain/session/state'
import { ServicesContext } from '../services'
import { testServices } from '../store/services.test-util'
import { TakeAway } from '../takeaway/TakeAway'
import { reviewNotes } from '../takeaway/reviewNotes'
import { Materials } from './Materials'
import { CopyList } from './CopyList'

const noop = () => {}
const { services } = testServices(createAbsent())

async function reviewed(design = exampleBookcase) {
  const state = services.useCases.fromExample(design)
  const review = await services.useCases.reviewPurchase(state, testCatalog, new AbortController().signal)
  return { ...state, review }
}

function renderMaterials(state: DesignState) {
  const design = currentDesign(state)
  const analysis = analyze(design, testCatalog)
  if (!analysis.valid) throw new Error('The fixture must resolve')
  return renderToStaticMarkup(h(ServicesContext.Provider, { value: services }, h(Materials, { state, design, geo: analysis.geo, catalog: testCatalog, instead: null, onRequest: noop })))
}

const buttons = (markup: string) => [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0])
const primaryButtons = (markup: string) => buttons(markup).filter((button) => /class="[^"]*\bbg-graphite\b/.test(button))
const guide = (state: DesignState) => renderToStaticMarkup(h(ServicesContext.Provider, { value: services }, h(TakeAway, { state })))

describe('Materials next step', () => {
  it('shows the cost and review action without exposing the unreviewed shopping list', () => {
    const markup = renderMaterials(services.useCases.fromExample(exampleBookcase))
    expect(markup).toContain('Costo aproximado')
    expect(primaryButtons(markup)).toHaveLength(1)
    expect(primaryButtons(markup)[0]).toContain('Revisar y ver materiales')
    expect(markup).not.toContain('Ver guía de cortes')
    expect(markup).not.toContain('Copiar lista para la maderería')
    expect(markup).not.toContain('Lista de corte ·')
  })

  it('makes the guide primary with one copy action and collapsed purchasing details', async () => {
    const state = await reviewed()
    expect(state.review.verdict).toBe('viable')
    const markup = renderMaterials(state)
    expect(primaryButtons(markup)).toHaveLength(1)
    expect(primaryButtons(markup)[0]).toContain('Ver guía de cortes')
    expect(buttons(markup).filter((button) => button.includes('Copiar lista para la maderería'))).toHaveLength(1)
    expect(markup).not.toContain('Hoja para llevar')
    for (const heading of ['Comprobaciones de Knotty', 'Hojas de triplay', 'Herrajes y consumibles', 'Acabado:', 'Lista de corte']) {
      expect(markup).toMatch(new RegExp(`<details[^>]*><summary[^>]*>${heading}`))
    }
    expect(markup).toMatch(/<details[^>]*open=""[^>]*><summary[^>]*><span[^>]*>2\. Confirmar materiales/)
  })

  it('keeps necessary changes visible before export and preserves them in the guide and copied text', async () => {
    const original = await reviewed()
    const review: PurchaseReview = {
      ...original.review,
      verdict: 'needs-changes',
      carpenter: { verdict: 'needs-changes', summary: 'Hace falta un listón para colgar.', problems: [{ title: 'Falta soporte para colgar', detail: 'La trasera no es un soporte de montaje.', severity: 'high', pieces: [exampleBookcase.pieces[0].id], request: 'Agregar un listón para colgar' }], tips: ['Marca las piezas antes de armar.'], origin: { promptId: 'test', provider: 'test', model: 'test' } },
    }
    const state = { ...original, review }
    const markup = renderMaterials(state)
    expect(primaryButtons(markup)).toHaveLength(1)
    expect(primaryButtons(markup)[0]).toContain('Ver guía con pendientes')
    expect(markup.indexOf('Falta soporte para colgar')).toBeLessThan(markup.indexOf('Guía y lista para llevar'))
    expect(markup).toContain('Necesario antes de construir')
    expect(markup).toContain('Aceptar así, bajo mi riesgo')
    const requestButton = buttons(markup).find((button) => button.includes('Conectar experto para pedir el ajuste'))
    expect(requestButton).toBeDefined()
    expect(requestButton).not.toContain('Agregar un listón')
    expect(guide(state)).toContain('Falta soporte para colgar')
    expect(reviewNotes(state, testCatalog).join('\n')).toContain('La trasera no es un soporte de montaje.')
  })

  it('requires an explicit opt-in before showing a not-viable purchase', async () => {
    const state = await reviewed()
    const markup = renderMaterials({ ...state, review: { ...state.review, verdict: 'not-viable', checks: [{ ...state.review.checks[0], status: 'fail', detail: 'La pieza no cabe en una hoja.' }] } })
    expect(markup).toContain('Ver la lista de todos modos')
    expect(markup).not.toContain('Ver guía de cortes')
    expect(markup).not.toContain('Copiar lista para la maderería')
  })

  it('does not show purchase actions for a stale review', async () => {
    const state = await reviewed()
    const edited = services.useCases.addRequirement(state, 'Necesito un cajón adicional')
    const markup = renderMaterials(edited)
    expect(markup).toContain('Revisar diseño actualizado')
    expect(markup).not.toContain('Ver guía de cortes')
    expect(guide(edited)).toContain('no tiene una revisión vigente')
  })

  it('carries an unknown wall into the printable guide instead of pretending the anchor list is complete', async () => {
    const state = await reviewed(exampleWallCabinet)
    expect(reviewNotes(state, testCatalog).join('\n')).toContain('Falta identificar el muro')
    expect(guide(state)).toContain('la lista no incluye los taquetes')
  })

  it('orders decisions and purchases before the final guide action', async () => {
    const markup = renderMaterials(await reviewed())
    expect(markup.indexOf('1. Revisar pendientes')).toBeLessThan(markup.indexOf('2. Confirmar materiales'))
    expect(markup.indexOf('Herrajes y consumibles')).toBeLessThan(markup.indexOf('3. Obtener tu guía'))
    expect(markup.indexOf('Lista de corte ·')).toBeLessThan(markup.indexOf('Ver guía de cortes'))
    expect(markup).toContain('Paso 2 de 3')
    expect(markup).toContain('Continuar a la guía')
  })

  it('saves and undoes a review decision without changing the technical verdict or export warnings', async () => {
    const original = await reviewed()
    const state = { ...original, review: { ...original.review, verdict: 'needs-changes' as const, carpenter: { verdict: 'needs-changes' as const, summary: 'Hace falta revisar el soporte.', problems: [{ title: 'Soporte pendiente', detail: 'El soporte necesita revisarse.', severity: 'high' as const, pieces: [], request: 'Revisar soporte' }], tips: [], origin: { promptId: 'test', provider: 'test', model: 'test' } } } }
    const chosen = services.useCases.choosePurchaseReview(state, testCatalog, 'expert:0', 'risk')
    const saved = DesignState.parse(services.useCases.load())
    expect(saved.review?.choices).toEqual([{ id: 'expert:0', choice: 'risk' }])
    expect(chosen.review?.verdict).toBe('needs-changes')
    expect(chosen.review?.checks).toEqual(state.review.checks)
    expect(renderMaterials(chosen)).toContain('Sin decisiones por tomar')
    expect(renderMaterials(chosen)).toContain('Deshacer decisión')
    expect(guide(chosen)).toContain('El soporte necesita revisarse.')
    expect(guide(chosen)).toContain('Decidiste mantenerlo bajo tu riesgo')
    expect(reviewNotes(chosen, testCatalog).filter((note) => note.startsWith('Soporte pendiente:'))).toHaveLength(1)
    expect(reviewNotes(chosen, testCatalog).join('\n')).toContain('el problema no está corregido')
    const undone = services.useCases.choosePurchaseReview(saved, testCatalog, 'expert:0', null)
    expect(undone.review?.choices).toEqual([])
    expect(renderMaterials(undone)).toContain('1 decisión por tomar')
    expect(reviewNotes(undone, testCatalog).join('\n')).not.toContain('Decidiste mantenerlo')
  })

  it('rejects stale or unknown decisions and cannot relabel a required change as optional', async () => {
    const original = await reviewed(exampleWallCabinet)
    const state = { ...original, review: { ...original.review, verdict: 'needs-changes' as const, carpenter: { verdict: 'needs-changes' as const, summary: 'Revisa el soporte.', problems: [{ title: 'Soporte pendiente', detail: 'No está corregido.', severity: 'medium' as const, pieces: [], request: 'Revisar soporte' }], tips: [], origin: { promptId: 'test', provider: 'test', model: 'test' } } } }
    expect(services.useCases.choosePurchaseReview(state, testCatalog, 'expert:0', 'keep')).toBe(state)
    expect(services.useCases.choosePurchaseReview(state, testCatalog, 'unknown', 'risk')).toBe(state)
    const stale = services.useCases.addRequirement(state, 'Necesito una puerta adicional')
    expect(services.useCases.choosePurchaseReview(stale, testCatalog, 'expert:0', 'risk')).toBe(stale)
    expect(reviewNotes(stale, testCatalog).join('\n')).toContain('no tiene una revisión vigente')
  })

  it('records a request without pretending it has applied a correction, and a new review clears prior choices', async () => {
    const original = await reviewed()
    const state = { ...original, review: { ...original.review, carpenter: { verdict: 'viable' as const, summary: 'Una mejora opcional.', problems: [{ title: 'Redondear esquinas', detail: 'Puedes conservar las esquinas rectas.', severity: 'low' as const, pieces: [], request: 'Redondear esquinas' }], tips: [], origin: { promptId: 'test', provider: 'test', model: 'test' } } } }
    const chosen = services.useCases.choosePurchaseReview(state, testCatalog, 'expert:0', 'keep')
    expect(renderMaterials(chosen)).toContain('Decidiste dejarlo así')
    const requested = services.useCases.choosePurchaseReview(state, testCatalog, 'expert:0', 'requested')
    expect(renderMaterials(requested)).toContain('Solicitud enviada al experto')
    expect(reviewNotes(requested, testCatalog).join('\n')).toContain('todavía no confirma una corrección')
    const fresh = await services.useCases.reviewPurchase(requested, testCatalog, new AbortController().signal)
    expect(services.useCases.saveReview(requested, fresh).review?.choices ?? []).toEqual([])
  })

  it('describes the same assembly capability that the printable guide actually has', async () => {
    const withoutPlan = renderMaterials(await reviewed())
    expect(withoutPlan).toContain('Cortes y diagramas · Sin fases de armado')
    expect(withoutPlan).toContain('Este diseño no tiene fases de armado')
    const state = services.useCases.openExample(exampleSideboard)
    const withPlan = { ...state, review: await services.useCases.reviewPurchase(state, testCatalog, new AbortController().signal) }
    expect(renderMaterials(withPlan)).toContain('pasos de armado, cortes y diagramas')
    expect(guide(withPlan)).not.toContain('no tiene instrucciones de armado por fases')
  })

  it('keeps clipboard live feedback within a positioned container', () => {
    const markup = renderToStaticMarkup(h(CopyList, { text: 'Lista de prueba' }))
    expect(markup).toMatch(/^<div class="relative /)
    expect(markup).toContain('class="sr-only" aria-live="polite"')
  })

  it('connects the guide to the real print action and includes the lumberyard checklist', async () => {
    const markup = guide(await reviewed())
    expect(buttons(markup).filter((button) => button.includes('Imprimir o guardar como PDF'))).toHaveLength(1)
    expect(markup).toContain('Antes de irte de la maderería')
    expect(markup).toContain('Las piezas, separadas')
    expect(markup).toContain('no tiene instrucciones de armado por fases')
  })

  it('keeps every expert problem visible when its verdict requires changes', async () => {
    const original = await reviewed()
    const state: DesignState = { ...original, review: { ...original.review, verdict: 'needs-changes', carpenter: { verdict: 'needs-changes', summary: 'Hay que ajustar el soporte.', problems: [{ title: 'Soporte pendiente', detail: 'Solicita el ajuste del soporte.', severity: 'low', pieces: [], request: 'Ajustar el soporte' }], tips: [], origin: { promptId: 'test', provider: 'test', model: 'test' } } } }
    const markup = renderMaterials(state)
    expect(markup.indexOf('Soporte pendiente')).toBeLessThan(markup.indexOf('Comprobaciones de Knotty'))
    expect(reviewNotes(state, testCatalog).join('\n')).toContain('Soporte pendiente')
  })

  it('makes sheet pieces keyboard controls with explicit selection state', async () => {
    const markup = renderMaterials(await reviewed())
    const pieces = [...markup.matchAll(/<g\b[^>]*role="button"[^>]*>/g)].map((match) => match[0])
    expect(pieces.length).toBeGreaterThan(0)
    for (const piece of pieces) {
      expect(piece).toContain('tabindex="0"')
      expect(piece).toContain('aria-pressed="false"')
      expect(piece).toContain('aria-label="Ver ')
    }
  })

  it('keeps selected finish precautions outside its closed options and in the guide', async () => {
    const state = services.useCases.chooseFinish(await reviewed(), 'danish-oil')
    const markup = renderMaterials(state)
    expect(markup).toMatch(/<\/details><div role="note" aria-label="Cuidados del acabado"/)
    expect(markup).toContain('Los trapos con aceite pueden prenderse solos')
    expect(guide(state)).toContain('Los trapos con aceite pueden prenderse solos')
  })

  it('offers a consultation when the expert supplied no concrete correction', async () => {
    const original = await reviewed()
    const state: DesignState = { ...original, review: { ...original.review, verdict: 'needs-changes', carpenter: { verdict: 'needs-changes', summary: 'Revisa el soporte antes de comprar.', problems: [], tips: [], origin: { promptId: 'test', provider: 'test', model: 'test' } } } }
    const markup = renderMaterials(state)
    expect(primaryButtons(markup)).toHaveLength(1)
    expect(primaryButtons(markup)[0]).toContain('Ver guía con pendientes')
    expect(markup).toContain('Conectar experto para consultar')
    expect(markup).toContain('Consultar los cambios necesarios')
  })
})
