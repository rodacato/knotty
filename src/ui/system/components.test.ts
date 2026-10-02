import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Button, Chip } from './components'
import { FORGET_HIT_AREA } from '../settings/Keys'

const UI = join(__dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'debug' ? [] : sources(path)
    return e.name.endsWith('.tsx') ? [path] : []
  })
}

describe('touch targets', () => {
  it('the kit Button is 44 px tall in every variant', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
      expect(renderToStaticMarkup(h(Button, { variant }, 'x'))).toMatch(/\bmin-h-11\b/)
    }
  })

  it('the Chip keeps a 44 px hit area over its 36 px look', () => {
    const markup = renderToStaticMarkup(h(Chip, null, 'x'))
    expect(markup).toContain('min-h-9')
    expect(markup).toContain('before:-inset-y-[5px]')
  })

  it('the forget-keys link keeps a 44 px hit area on the idle link and on both confirmation buttons', () => {
    expect(FORGET_HIT_AREA).toContain('before:-inset-y-3.5')
    expect(FORGET_HIT_AREA).toContain('before:inset-x-0')
    const source = readFileSync(join(UI, 'settings/Keys.tsx'), 'utf8')
    const body = source.slice(source.indexOf('export function ForgetKeys'), source.indexOf('/** Opens the encrypted'))
    expect(body.match(/\$\{FORGET_HIT_AREA\}/g)).toHaveLength(3)
  })

  // The radio sites belong to the RadioCard pass (UI-47); they are listed so they cannot grow unnoticed.
  const RADIO = /role="radio"/

  it('no button or Button sets a height under 44 px without a larger hit area', () => {
    const offenders: string[] = []
    for (const file of sources(UI)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/<(?:button|Button)\b/g)) {
        const tag = text.slice(m.index, m.index + 900)
        const open = tag.replace(/=>/g, '=_').split('>')[0]
        const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(open)
        if (!cls) continue
        const classes = cls[1] ?? cls[2]
        const small = /\b(?:min-h|size|h)-(?:[1-9]|10)\b|\bpy-(?:0|0\.5|1)\b/.test(classes)
        const reach = /before:-inset-/.test(classes)
        if (small && !reach && !RADIO.test(open)) offenders.push(`${file.slice(UI.length + 1)}: ${classes.slice(0, 60)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
