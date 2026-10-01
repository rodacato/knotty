import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PassphraseField } from '../settings/Keys'
import { Reveal } from './Reveal'

const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node)

describe('Reveal', () => {
  it('names what it shows so the key and the passphrase differ', () => {
    expect(render(h(Reveal, { what: 'llave', shown: false, onToggle: () => {} }))).toContain('aria-label="Mostrar la llave"')
    expect(render(h(Reveal, { what: 'frase', shown: false, onToggle: () => {} }))).toContain('aria-label="Mostrar la frase"')
  })

  it('names the hide state', () => {
    expect(render(h(Reveal, { what: 'frase', shown: true, onToggle: () => {} }))).toContain('aria-label="Ocultar la frase"')
  })
})

describe('PassphraseField', () => {
  const field = (error: string) => h(PassphraseField, { label: 'Frase', placeholder: 'x', value: '', onChange: () => {}, error })

  it('starts hidden, with the eye and no alert', () => {
    const markup = render(field(''))
    expect(markup).toContain('type="password"')
    expect(markup).toContain('aria-label="Mostrar la frase"')
    expect(markup).not.toContain('role="alert"')
  })

  it('announces the error and links it to the input', () => {
    const markup = render(field('Frase incorrecta.'))
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('border-rust')
  })

  it('keeps the eye out of the label that names the input', () => {
    const markup = render(field(''))
    const label = markup.match(/<label[^>]*>(.*?)<\/label>/)![1]
    expect(label).toBe('Frase')
    expect(markup).toMatch(/<label for="([^"]+)"/)
    const id = markup.match(/<label for="([^"]+)"/)![1]
    expect(markup).toContain(`id="${id}"`)
  })

  it('renders a hidden label as a sibling that takes no flex slot', () => {
    const markup = render(h(PassphraseField, { label: 'Frase secreta', hiddenLabel: true, placeholder: 'x', value: '', onChange: () => {}, error: '' }))
    expect(markup).toMatch(/<label for="[^"]+" class="sr-only">Frase secreta<\/label>/)
    expect(markup).not.toContain('<span class="sr-only">')
    expect(markup).not.toContain('text-graphite-2">Frase secreta')
  })
})
