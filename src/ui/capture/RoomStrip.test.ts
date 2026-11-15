import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBundledReferences } from '../../adapters/references/store'
import { roomChips } from './catalog'
import { RoomStrip } from './RoomStrip'

describe('the room strip', () => {
  it('prints one cell per room with its count, and only the chosen one in solid ink', () => {
    const chips = roomChips(createBundledReferences().home(), { room: 'living', text: '' })
    const page = renderToStaticMarkup(h(RoomStrip, { chips, chosen: 'living', onChoose: () => {} }))
    const cells = page.match(/<button[^>]*>.*?<\/button>/g) ?? []
    expect(cells).toHaveLength(chips.length)
    for (const { label, count } of chips) expect(page).toMatch(new RegExp(`${label} <span class="numerals[^"]*">${count}</span>`))
    const pressed = cells.filter((c) => c.includes('aria-pressed="true"'))
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toContain('Sala')
    expect(pressed[0]).toMatch(/bg-graphite[^"]*text-bone/)
    expect(cells.filter((c) => c.includes('bg-graphite'))).toHaveLength(1)
  })
})
