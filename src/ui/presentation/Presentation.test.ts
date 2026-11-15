import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import catalogData from '../../../public/catalog/catalog.json'
import { createBundledReferences } from '../../adapters/references/store'
import { Catalog } from '../../domain/materials/catalog'
import { cardsOf } from '../capture/cards'
import { exampleSheet } from './exampleSheet'

const catalog = Catalog.parse(catalogData)
const references = createBundledReferences()

describe('exampleSheet', () => {
  it('finds the sideboard top on the sheet Knotty lays out for it', () => {
    const sheet = exampleSheet(references.latest('KC-APA-01')!, catalog, 'Techo')!
    expect(sheet).not.toBeNull()
    const placed = sheet.a.sheets[sheet.index].placed.find((c) => c.id === sheet.chosen)!
    expect(placed.name).toBe('Techo')
    expect(sheet.numbers.get(sheet.chosen)).toBeGreaterThan(0)
  })

  it('has nothing to show for a piece the example does not have', () => {
    expect(exampleSheet(references.latest('KC-APA-01')!, catalog, 'Pieza inexistente')).toBeNull()
  })
})

describe('Presentation', async () => {
  const { Presentation } = await import('./Presentation')
  const examples = cardsOf(references.home(), catalog)
  const sheet = exampleSheet(references.latest('KC-APA-01')!, catalog, 'Techo')
  const page = renderToStaticMarkup(h(Presentation, { examples, scene: 'scene.jpg', sheet }))

  it('draws the computed sheet with the top hatched, not a picture of a list', () => {
    expect(page).toMatch(/Hoja \d+ de \d+ · desperdicio \d+ %/)
    expect(page).toContain(`data-piece="${sheet!.chosen}"`)
    expect(page).not.toContain('role="button"')
  })

  it('spends vermilion on one action only', () => {
    expect(page.match(/page-link-primary/g)).toHaveLength(1)
  })
})
