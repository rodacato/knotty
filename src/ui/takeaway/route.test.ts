import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createAbsent } from '../../adapters/llm/absent/absent'
import { exampleSideboard } from '../../domain/furniture/fixtures/references.test-util'
import { ServicesContext } from '../services'
import { testServices } from '../store/services.test-util'
import { route } from './route'
import { TakeAway } from './TakeAway'

const { services } = testServices(createAbsent())

describe('the guide as a route', () => {
  it('numbers the five sections in order, the lumberyard first', () => {
    const roles = route('complete', true)
    expect(roles.map((r) => r.name)).toEqual(['Para la maderería', 'Para armar'])
    expect(roles.flatMap((r) => r.steps.map((s) => `${s.number} ${s.label}`))).toEqual([
      '01 Lista de corte',
      '02 Mecanizado y perfiles',
      '03 Compra de herrajes y consumibles',
      '04 Armado por fases',
      '05 Ajustes e instalación',
    ])
  })

  it('keeps one role per partial guide, with the numbers of the whole route', () => {
    expect(route('yard', true).map((r) => r.role)).toEqual(['yard'])
    expect(route('assembly', true)[0].steps.map((s) => s.number)).toEqual(['03', '04', '05'])
    expect(route('complete', false).flatMap((r) => r.steps.map((s) => s.label))).not.toContain('Armado por fases')
  })

  it('prints the sections in the order of the route, each linked from its cell', () => {
    const markup = renderToStaticMarkup(h(ServicesContext.Provider, { value: services }, h(TakeAway, { state: services.useCases.openExample(exampleSideboard) })))
    const ids = route('complete', true).flatMap((r) => r.steps.map((s) => s.id))
    for (const id of ids) expect(markup).toContain(`href="#${id}"`)
    const sections = ids.map((id) => markup.indexOf(`<section id="${id}"`))
    expect(sections.every((at) => at >= 0)).toBe(true)
    expect(sections).toEqual([...sections].sort((a, b) => a - b))
  })
})
