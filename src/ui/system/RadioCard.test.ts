import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RadioCard, RadioGroup } from './RadioCard'

const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node)
const noop = () => {}

const group = (chosen: number, props: Partial<Parameters<typeof RadioCard>[0]> = {}) =>
  h(RadioGroup, { label: 'Acabado', children: [0, 1, 2].map((i) => h(RadioCard, { key: i, checked: i === chosen, onChange: noop, ...props, children: `Opción ${i}` })) })

describe('RadioCard', () => {
  it('is a native radio inside its label, so the text names it', () => {
    const markup = render(group(0))
    expect(markup.match(/<input type="radio"/g)).toHaveLength(3)
    expect(markup).not.toContain('role="radio"')
    expect(markup).toMatch(/<label[^>]*><input[^>]*\/>Opción 0/)
  })

  it('shares one name across the group, which is what gives one tab stop and the arrow keys', () => {
    const names = [...render(group(0)).matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1])
    expect(names).toHaveLength(3)
    expect(new Set(names).size).toBe(1)
    const two = [...render(h('div', null, group(0), group(0))).matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(two).size).toBe(2)
  })

  it('names the group for assistive technology only when it has a label', () => {
    expect(render(group(0))).toContain('role="radiogroup" aria-label="Acabado"')
    expect(render(h(RadioGroup, { children: null }))).not.toContain('aria-label')
  })

  it('checks only the chosen one', () => {
    const inputs = render(group(1)).match(/<input[^>]*>/g)!
    expect(inputs.map((i) => i.includes('checked=""'))).toEqual([false, true, false])
  })

  it('marks the chosen card with a check, not only a tint', () => {
    const markup = render(group(2))
    expect(markup.match(/<svg/g)).toHaveLength(1)
    expect(markup).toContain('border-graphite bg-amber-soft')
    expect(render(group(2, { mark: false }))).not.toContain('<svg')
  })

  it('leaves the look to the parent in the bare variant and draws no pill fill', () => {
    const markup = render(group(0, { variant: 'bare' }))
    expect(markup).not.toContain('<svg')
    expect(markup).not.toContain('bg-amber-soft')
    expect(render(group(0, { variant: 'pill' }))).toContain('bg-graphite text-bone')
  })

  it('shows the focus ring on the card when the hidden input is focused', () => {
    expect(render(group(0))).toContain('has-[:focus-visible]:outline-2')
    expect(render(group(0))).toContain('sr-only')
  })

  it('passes disabled and an explicit accessible name to the input', () => {
    const markup = render(h(RadioCard, { checked: false, onChange: noop, disabled: true, label: 'Anthropic', children: 'x' }))
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('aria-label="Anthropic"')
  })
})
