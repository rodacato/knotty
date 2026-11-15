import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrandGuide } from './BrandGuide'

const page = renderToStaticMarkup(h(BrandGuide))
const count = (pattern: RegExp) => page.match(pattern)?.length ?? 0

describe('the brand guide', () => {
  it('prints the four marks of the kit on plates captioned with their titles', () => {
    for (const [file, title] of [
      ['knotty-mark.svg', 'Marca a dos tintas'],
      ['knotty-mono.svg', 'Marca a una tinta'],
      ['knotty-inverse.svg', 'Marca en claro'],
      ['knotty-emblem.svg', 'Emblema · la tabla del nudo'],
    ]) {
      expect(page).toMatch(new RegExp(`<figure class="logo-plate[^"]*"><div><img src="../brand/${file}"[^>]*/></div><figcaption>${title}</figcaption>`))
    }
    expect(count(/class="logo-plate logo-plate-inverse"/g)).toBe(1)
  })

  it('shows every colour as a ruled cell and the three typefaces by name', () => {
    expect(count(/class="color-cell"/g)).toBe(11)
    expect(page).toMatch(/type-name-display">Oswald</)
    expect(page).toMatch(/type-name-sans">Libre Franklin</)
    expect(page).toMatch(/type-name-mono">IBM Plex Mono</)
  })

  it('has one vermilion action, the kit download', () => {
    expect(count(/page-link-primary/g)).toBe(1)
    expect(page).toMatch(/page-link-primary"[^>]*>Descargar todo</)
  })
})
