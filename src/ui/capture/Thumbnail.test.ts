import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Box } from '../../domain/design/resolve'
import { Thumbnail } from './Thumbnail'

const box = (x0: number, x1: number, y0: number, y1: number): Box => ({ x0, x1, y0, y1, z0: 0, z1: 400 })
const boxes = new Map([
  ['lateral', box(0, 18, 0, 900)],
  ['techo', box(0, 1600, 900, 918)],
  ['piso', box(0, 1600, 0, 18)],
])
const draw = (chosen: string | null) => renderToStaticMarkup(createElement(Thumbnail, { boxes, ink: true, chosen }))

describe('Thumbnail', () => {
  it('hatches every visible face of the chosen piece and no other', () => {
    const html = draw('techo')
    const hatched = [...html.matchAll(/<g data-piece="([^"]+)">(?:(?!<\/g>).)*data-chosen/g)].map((m) => m[1])
    expect(hatched).toEqual(['techo', 'techo', 'techo'])
    expect(html).toContain('<pattern')
  })

  it('draws no hatching when nothing is chosen', () => {
    const html = draw(null)
    expect(html).not.toContain('data-chosen')
    expect(html).not.toContain('<pattern')
  })
})
