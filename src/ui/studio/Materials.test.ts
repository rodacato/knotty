import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createAbsent } from '../../adapters/llm/absent/absent'
import { analyze } from '../../domain/checks/analysis'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { exampleWallCabinet } from '../../domain/furniture/fixtures/wallCabinet'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { currentDesign, type DesignState, type PurchaseReview } from '../../domain/session/state'
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
    expect(markup).not.toContain('Ver guía para construir')
    expect(markup).not.toContain('Copiar lista para la maderería')
    expect(markup).not.toContain('Lista de corte ·')
  })

  it('makes the guide primary with one copy action and collapsed purchasing details', async () => {
    const state = await reviewed()
    expect(state.review.verdict).toBe('viable')
    const markup = renderMaterials(state)
    expect(primaryButtons(markup)).toHaveLength(1)
    expect(primaryButtons(markup)[0]).toContain('Ver guía para construir')
    expect(buttons(markup).filter((button) => button.includes('Copiar lista para la maderería'))).toHaveLength(1)
    expect(markup).not.toContain('Hoja para llevar')
    for (const heading of ['Detalles de la revisión', 'Hojas de triplay', 'Herrajes y consumibles', 'Acabado:', 'Lista de corte']) {
      expect(markup).toMatch(new RegExp(`<details[^>]*><summary[^>]*>${heading}`))
    }
    expect(markup).not.toMatch(/<details[^>]*\bopen(?:=|>)/)
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
    expect(primaryButtons(markup)[0]).toContain('Ver qué corregir')
    expect(markup.indexOf('Falta soporte para colgar')).toBeLessThan(markup.indexOf('Guía y lista para llevar'))
    expect(markup).toContain('Problema crítico')
    expect(markup).toContain('Conecta un experto para solicitar este cambio.')
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
    expect(markup).not.toContain('Ver guía para construir')
    expect(markup).not.toContain('Copiar lista para la maderería')
  })

  it('does not show purchase actions for a stale review', async () => {
    const state = await reviewed()
    const edited = services.useCases.addRequirement(state, 'Necesito un cajón adicional')
    const markup = renderMaterials(edited)
    expect(markup).toContain('Revisar diseño actualizado')
    expect(markup).not.toContain('Ver guía para construir')
    expect(guide(edited)).toContain('no tiene una revisión vigente')
  })

  it('carries an unknown wall into the printable guide instead of pretending the anchor list is complete', async () => {
    const state = await reviewed(exampleWallCabinet)
    expect(reviewNotes(state, testCatalog).join('\n')).toContain('Falta identificar el muro')
    expect(guide(state)).toContain('la lista no incluye los taquetes')
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
    expect(markup.indexOf('Soporte pendiente')).toBeLessThan(markup.indexOf('Detalles de la revisión'))
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
    expect(primaryButtons(markup)[0]).toContain('Conectar experto para consultar')
    expect(markup).toContain('no detalla cómo hacerlos')
  })
})
