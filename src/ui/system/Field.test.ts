import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusChip } from '../studio/StatusChip'
import { ErrorText, Field, Input, Select, TextArea } from './Field'

const render = (node: ReactElement) => renderToStaticMarkup(node)
const attr = (markup: string, tag: string, name: string) => new RegExp(`<${tag}[^>]*? ${name}="([^"]*)"`).exec(markup)?.[1]

describe('Field', () => {
  it('announces the error outside the label and links it to the control', () => {
    const markup = render(h(Field, { label: 'Ancho', error: 'Muy chico.', children: h(Input) }))
    const id = attr(markup, 'p', 'id')
    expect(id).toBeTruthy()
    expect(markup).toContain(`<p id="${id}" role="alert"`)
    expect(attr(markup, 'input', 'aria-describedby')).toBe(id)
    expect(attr(markup, 'input', 'aria-invalid')).toBe('true')
    expect(markup.slice(markup.indexOf('</label>'))).toContain('Muy chico.')
    expect(markup.slice(0, markup.indexOf('</label>'))).not.toContain('Muy chico.')
  })

  it('links help text without raising an alert', () => {
    const markup = render(h(Field, { label: 'Ancho', help: 'En milímetros.', children: h(Select) }))
    expect(markup).not.toContain('role="alert"')
    expect(markup).toContain(`<span id="${attr(markup, 'select', 'aria-describedby')}"`)
    expect(markup).not.toContain('aria-invalid')
  })

  it('has no description when there is nothing to say', () => {
    expect(render(h(Field, { label: 'Notas', children: h(TextArea) }))).not.toContain('aria-describedby')
  })

  it('renders a standalone error line as an alert', () => {
    expect(render(h(ErrorText, { id: 'e', children: 'Mal.' }))).toContain('id="e" role="alert"')
  })
})

describe('StatusChip', () => {
  const base = { key: 'k', icon: null, label: 'Resuelto' }

  it('is a status region without an action', () => {
    expect(render(h(StatusChip, { statuses: [base] }))).toMatch(/^<div role="status"[^>]*>.*Resuelto/)
  })

  it('keeps the button a button inside a status region', () => {
    expect(render(h(StatusChip, { statuses: [{ ...base, onClick: () => {} }] }))).toMatch(/^<div role="status"[^>]*><button/)
  })

  describe('placeholder colour', () => {
    const tagOf = (markup: string, tag: string) => new RegExp(`<${tag}[^>]*>`).exec(markup)?.[0] ?? ''
    const CLASS = 'placeholder:text-graphite-2'

    it('reaches a plain input and a textarea', () => {
      expect(tagOf(render(h(Input)), 'input')).toContain(CLASS)
      expect(tagOf(render(h(TextArea)), 'textarea')).toContain(CLASS)
    })

    it('reaches the inner input, not the frame, when there is a unit or an end', () => {
      for (const props of [{ unit: 'cm' }, { end: h('button', null, 'x') }]) {
        const markup = render(h(Input, props))
        expect(tagOf(markup, 'span')).not.toContain(CLASS)
        expect(tagOf(markup, 'input')).toContain(CLASS)
      }
    })
  })
})
