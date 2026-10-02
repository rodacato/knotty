import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChangeListView } from './ChangeList'
import { ProposalFixAction } from './ProposalFix'
import { SheLLM } from './SheLLM'
import { ForgetKeysPrompt, UnlockForm, UNLOCK_TEXT } from './Unlock'

const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node)
const noop = () => {}

describe('UnlockForm', () => {
  const form = (over: Partial<Parameters<typeof UnlockForm>[0]> = {}) =>
    render(h(UnlockForm, { passphrase: '', onPassphrase: noop, error: '', opening: false, onSubmit: noop, onForget: noop, ...over }))

  it('shows the text, the hidden-label field, the disabled submit and the forget link', () => {
    const markup = form()
    expect(markup).toContain(UNLOCK_TEXT)
    expect(markup).toContain('class="sr-only">Frase secreta</label>')
    expect(markup).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Desbloquear</)
    expect(markup).toContain('Olvidé la frase: borrar las llaves guardadas')
  })

  it('enables the submit with a passphrase and says it is opening', () => {
    expect(form({ passphrase: 'x' })).not.toContain('disabled=""')
    expect(form({ passphrase: 'x', opening: true })).toContain('Abriendo…')
  })

  it('announces the error under the field', () => {
    expect(form({ error: 'Frase incorrecta.' })).toContain('role="alert"')
  })
})

describe('ForgetKeysPrompt', () => {
  it('starts as the idle link, not as the confirmation', () => {
    const markup = render(h(ForgetKeysPrompt, { onForget: noop }))
    expect(markup).toContain('text-rust')
    expect(markup).not.toContain('Sí, borrarlas')
  })
})

describe('SheLLM', () => {
  const markup = render(h(SheLLM, { host: 'http://127.0.0.1:6100', onHost: noop, origin: 'https://knotty.test', learnUrl: 'https://shellm.test' }))

  it('puts the host in the field and the origin in the line to copy', () => {
    expect(markup).toContain('value="http://127.0.0.1:6100"')
    expect(markup).toContain('SHELLM_CORS_ORIGINS=https://knotty.test')
  })

  it('links to where to learn about it', () => {
    expect(markup).toContain('href="https://shellm.test"')
    expect(markup).toContain('aria-label="Copiar"')
  })
})

describe('ChangeListView', () => {
  const change = {
    direct: [
      { id: 'a', name: 'Estante', kind: 'changed' as const, detail: '18 → 15 mm de espesor' },
      { id: 'b', name: 'Tapa', kind: 'removed' as const, detail: '' },
    ],
    followed: ['c'],
    dimensions: '600 → 736 mm de ancho',
  }
  const view = (over: Partial<Parameters<typeof ChangeListView>[0]> = {}) =>
    render(h(ChangeListView, { change, thinking: false, onSelect: noop, onRestore: () => ({ ok: true as const }), onUndo: () => ({ ok: true as const }), ...over }))

  it('counts the changes and the pieces that followed', () => {
    expect(view()).toContain('Qué cambió (3) · 1 pieza se ajustó sola')
  })

  it('offers a way back for each piece and for the whole change', () => {
    const markup = view()
    expect(markup).toContain('Regresar')
    expect(markup).toContain('Medidas del mueble: 600 → 736 mm de ancho')
    expect(markup).toContain('Deshacer este cambio')
  })

  it('disables the ways back while the expert thinks', () => {
    expect(view({ thinking: true }).match(/disabled=""/g)).toHaveLength(3)
  })

  it('renders nothing when there is nothing to say', () => {
    expect(view({ change: null })).toBe('')
    expect(view({ change: { direct: [], followed: [], dimensions: null } })).toBe('')
  })

  it('inside the bubble it follows a hairline', () => {
    expect(view({ inBubble: true })).toContain('border-t border-line')
    expect(view()).not.toContain('border-t border-line')
  })
})

describe('ProposalFixAction', () => {
  it('is a primary button with the label and the bolt', () => {
    const markup = render(h(ProposalFixAction, { label: 'Aplicar con un apoyo al centro', onApply: noop, disabled: false, className: 'w-full' }))
    expect(markup).toContain('Aplicar con un apoyo al centro')
    expect(markup).toContain('w-full')
    expect(markup).toContain('<svg')
    expect(markup).not.toContain('disabled=""')
  })

  it('is disabled while the expert thinks', () => {
    expect(render(h(ProposalFixAction, { label: 'x', onApply: noop, disabled: true }))).toContain('disabled=""')
  })
})
