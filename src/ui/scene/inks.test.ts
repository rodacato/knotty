import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INK, INK_2, PAPER, RUST } from './inks'

const tokens = readFileSync(new URL('../system/tokens.css', import.meta.url), 'utf8')

describe('the scene inks', () => {
  it('are the inks of the page', () => {
    expect(tokens).toContain(`--color-drawing-paper: ${PAPER};`)
    expect(tokens).toContain(`--graphite: ${INK};`)
    expect(tokens).toContain(`--graphite-2: ${INK_2};`)
    expect(tokens).toContain(`--rust: ${RUST};`)
  })
})
