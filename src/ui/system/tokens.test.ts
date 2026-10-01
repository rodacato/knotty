import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const light = declarations(/\n:root \{([^}]*)\}/.exec(css)![1])
const dark = { ...light, ...declarations(/prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/.exec(css)![1]) }

type Rgb = [number, number, number]

function declarations(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

function rgb(value: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb
  const fn = /^rgb\((\d+) (\d+) (\d+)/.exec(value)
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])]
  throw new Error(`unsupported color ${value}`)
}

const luminance = ([r, g, b]: Rgb) => {
  const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as Rgb

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_, t) => {
  const c = (name: string) => rgb(t[name])

  it('draws the focus ring at 3:1 or more on every surface', () => {
    for (const surface of ['bone', 'kraft']) expect(contrast(c('focus'), c(surface))).toBeGreaterThanOrEqual(3)
  })

  it('keeps the on-rust label at 4.5:1 on rust', () => {
    expect(contrast(c('on-rust'), c('rust'))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps rust text readable on paper, bone and its own 10% tint', () => {
    for (const surface of ['paper', 'bone']) expect(contrast(c('rust'), c(surface))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(c('rust'), over(c('rust'), c('bone'), 0.1))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps a disabled button label at 4.5:1 on its muted fill', () => {
    expect(contrast(c('graphite-2'), c('kraft'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('paper', () => {
  it('is a slight elevation of bone in both themes, not a highlight', () => {
    for (const t of [light, dark]) expect(contrast(rgb(t.paper), rgb(t.bone))).toBeLessThan(1.3)
  })
})

describe('focus rule', () => {
  it('is global, sits in the base layer so utilities can override it, and uses the focus token', () => {
    expect(css).toMatch(/@layer base \{\s*\*:focus-visible \{\s*outline: 2px solid var\(--focus\);\s*outline-offset: 2px;/)
  })
})
