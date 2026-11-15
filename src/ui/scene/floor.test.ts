import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FLOOR_LINES, PAPER } from './floor'

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const luminance = (hex: string) => rgb(hex).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)

describe('the scene floor', () => {
  it('is the drawing paper the page uses', () => {
    const tokens = readFileSync(new URL('../system/tokens.css', import.meta.url), 'utf8')
    expect(tokens).toContain(`--color-drawing-paper: ${PAPER};`)
  })

  it('rules the paper in ink: every line darker than the paper, the sections darker than the cells, all warm', () => {
    expect(luminance(FLOOR_LINES.cell)).toBeLessThan(luminance(PAPER))
    expect(luminance(FLOOR_LINES.section)).toBeLessThan(luminance(FLOOR_LINES.cell))
    for (const line of Object.values(FLOOR_LINES)) {
      const [r, g, b] = rgb(line)
      expect(r).toBeGreaterThanOrEqual(g)
      expect(g).toBeGreaterThan(b)
    }
  })
})
