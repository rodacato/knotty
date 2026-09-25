import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis'
import { exampleBookcase } from '../fixtures/bookcase'
import { testCatalog } from '../fixtures/catalog.test-util'
import { ALTERNATIVES, isBuildKey } from './alternatives'

const DOMAIN = join(import.meta.dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return name.endsWith('.ts') && !/\.test(-util)?\.ts$/.test(name) ? [readFileSync(path, 'utf8')] : []
  })
}

describe('alternatives', () => {
  it('every key a rule offers is declared', () => {
    const offered = [join(DOMAIN, 'structure', 'rules'), join(DOMAIN, 'typology')].flatMap(sources).flatMap((code) => [...code.matchAll(/\bkey: '([^']+)'/g)].map((m) => m[1]))
    expect(offered.length).toBeGreaterThan(0)
    expect(offered.filter((key) => !(key in ALTERNATIVES))).toEqual([])
  })

  it('every key Knotty builds has its case in fixes, and fixes builds nothing else', () => {
    const cases = [...readFileSync(join(DOMAIN, 'fixes', 'fixes.ts'), 'utf8').matchAll(/\bcase '([^']+)':/g)].map((m) => m[1])
    const build = Object.keys(ALTERNATIVES).filter(isBuildKey)
    expect([...cases].sort()).toEqual([...build].sort())
  })

  it('the longest span of a sagging board is data of the finding, not a way out', () => {
    const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }
    const analysis = analyze(wide, testCatalog)
    if (!analysis.valid) throw new Error(analysis.errors[0].message)
    const sag = analysis.findings.find((h) => h.code === 'R1_SAG')!
    expect(sag.data.maxSpan).toBeGreaterThan(0)
    expect(sag.data.maxSpan).toBeLessThan(sag.data.span as number)
    expect(sag.alternatives.every((a) => a.key in ALTERNATIVES)).toBe(true)
  })
})
