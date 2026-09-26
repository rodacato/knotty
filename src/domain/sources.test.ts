import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSUMPTIONS, ASSUMPTION_SOURCES } from './checks/structure/assumptions'
import { GEOMETRY_SOURCES } from './design/validation/geometry'
import { VIABILITY_SOURCES } from './checks/viability/viability'
import { MODULE_SOURCES } from './furniture/modules/common'
import { SLIDE_SOURCES } from './materials/catalog'
import { DOOR_SOURCES } from './design/doors'
import { SCREW_RULE_SOURCES } from './checks/structure/rules/screws'
import { ROOT, sourceProblem } from './sources.test-util'

// Every threshold the checks and the modules use says where it comes from: a row of docs/carpinteria, or why there is none.

/** Each file with loose thresholds, and its sources by constant name. */
const FILES: Record<string, Record<string, string>> = {
  'src/domain/design/validation/geometry.ts': GEOMETRY_SOURCES,
  'src/domain/checks/viability/viability.ts': VIABILITY_SOURCES,
  'src/domain/furniture/modules/common.ts': MODULE_SOURCES,
  'src/domain/materials/catalog.ts': SLIDE_SOURCES,
  'src/domain/design/doors.ts': DOOR_SOURCES,
  'src/domain/checks/structure/rules/screws.ts': SCREW_RULE_SOURCES,
}
/** The rule files: their numbers live in ASSUMPTIONS, so a named constant here needs a source too. */
const RULES = ['deflection', 'drawers', 'jointThickness', 'racking', 'screws', 'usage'].map((f) => `src/domain/checks/structure/rules/${f}.ts`)

/** A named constant set to a number, or to an object of numbers `as const` (KICK_HEIGHT). */
const NUMERIC_CONSTANT = /^(?:export )?const ([A-Z][A-Z0-9_]*) = (?:-?[\d.]+\b|\{[^}\n]*\d[^}\n]*\} as const)/gm
const constantsIn = (path: string) => [...readFileSync(join(ROOT, path), 'utf8').matchAll(NUMERIC_CONSTANT)].map((m) => m[1])

/** Every path to a number or a table in ASSUMPTIONS: "screws.minPenetration", "doors.hinges". */
function leaves(value: unknown, path = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  return [path]
}
const covered = (path: string) => path.split('.').some((_, i, parts) => parts.slice(0, i + 1).join('.') in ASSUMPTION_SOURCES)

describe('sources of the thresholds', () => {
  it('every assumption has a source, itself or its group, and every source names an assumption', () => {
    const paths = leaves(ASSUMPTIONS)
    expect(paths.filter((p) => !covered(p))).toEqual([])
    expect(Object.keys(ASSUMPTION_SOURCES).filter((k) => !paths.some((p) => p === k || p.startsWith(`${k}.`)))).toEqual([])
  })

  it('every named threshold in these files has a source, and every source names one', () => {
    const missing = Object.entries(FILES).flatMap(([path, sources]) => constantsIn(path).filter((name) => !(name in sources)).map((name) => `${path} ${name}`))
    const stale = Object.entries(FILES).flatMap(([path, sources]) => Object.keys(sources).filter((name) => !constantsIn(path).includes(name)).map((name) => `${path} ${name}`))
    expect(missing).toEqual([])
    expect(stale).toEqual([])
  })

  it('the rules name no threshold of their own outside ASSUMPTIONS', () => {
    const own = RULES.flatMap((path) => constantsIn(path).filter((name) => !(name in (FILES[path] ?? {}))).map((name) => `${path} ${name}`))
    expect(own).toEqual([])
  })

  const all = [...Object.entries(ASSUMPTION_SOURCES).map(([k, s]) => [`ASSUMPTIONS.${k}`, s] as const), ...Object.values(FILES).flatMap((sources) => Object.entries(sources))]
  it.each(all)('%s: its file, heading and row are in docs/carpinteria, or it says why there is none', (_, source) => {
    expect(sourceProblem(source)).toBeNull()
  })
})
