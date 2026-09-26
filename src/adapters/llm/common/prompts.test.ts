import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { testCatalog } from '../../../domain/fixtures/catalog.test-util'
import { materialById, usableSheet } from '../../../domain/materials/catalog'
import { MIN_DRAWER_OPENING_HEIGHT } from '../../../domain/operations/drawer'
import { ASSUMPTIONS } from '../../../domain/structure/assumptions'
import { MATTRESSES } from '../../../domain/modules/bed'
import { TYPICAL_TABLE_DIMENSIONS } from '../../../domain/modules/table'
import { DEFAULT_CONSTRUCTION } from '../../../domain/modules/cabinet'
import { FURNITURE_KINDS, MODULES } from '../../../domain/modules/plan'
import { WRITTEN_BY_HAND } from './modulePrompts'
import { PLAN_ADJUSTMENT, PROMPTS, PURCHASE_REVIEW, READING, RECONSTRUCTION, render, SKELETON, systemFor } from './prompts'
import { fill, placeholdersIn, promptValues } from './promptValues'

/** The prompt files as written, by file name. */
const FILES = import.meta.glob<string>('../prompts/*.md', { query: '?raw', import: 'default', eager: true })
const byName = Object.entries(FILES).map(([path, raw]) => ({ name: path.split('/').at(-1)!, raw }))

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The literal, not as part of a longer number: "600" does not match "1600" or "600.5". */
const contains = (text: string, literal: string) => new RegExp(`(?<![\\d.])${escape(literal)}(?![\\d.]*\\d)`).test(text)

describe('prompt files', () => {
  it('each file is loaded and named after its id (name@version → name.vversion.md)', () => {
    const expected = PROMPTS.map((p) => `${p.id.replace('@', '.v')}.md`).sort()
    expect(byName.map((f) => f.name).sort()).toEqual(expected)
  })
})

describe('placeholders', () => {
  const values = promptValues(testCatalog)

  it.each(PROMPTS)('$id has nothing left to fill once rendered', (prompt) => {
    expect(render(prompt, testCatalog)).not.toMatch(/\{\{|\}\}/)
  })

  it('the expert reads the materials as it always did: id, name, thickness and kind', () => {
    expect(values.catalog?.text.split('\n').slice(0, 6)).toEqual([
      'Materials:',
      '- T12: Triplay de pino 12 mm, 12 mm (plywood)',
      '- T15: Triplay de pino 15 mm, 15 mm (plywood)',
      '- T18: Triplay de pino 18 mm, 18 mm (plywood)',
      '- TR3: Triplay de pino 3 mm (trasera), 3 mm (back)',
      '- TR6: Triplay de pino 6 mm (trasera), 6 mm (back)',
    ])
    expect(values.materials?.text).toBe('one of "T12" (12 mm), "T15" (15 mm), "T18" (18 mm)')
  })

  it('every placeholder a prompt uses has a value', () => {
    const used = PROMPTS.flatMap((p) => placeholdersIn(p.text))
    expect(used.filter((name) => !(name in values))).toEqual([])
  })

  it('every value is used by some prompt: no dead entries', () => {
    const used = new Set(PROMPTS.flatMap((p) => placeholdersIn(p.text)))
    expect(Object.keys(values).filter((name) => !used.has(name))).toEqual([])
  })

  it('the photo reading renders without a catalog, and a catalog value without one is an error', () => {
    expect(render(READING, null)).toBe(READING.text)
    expect(() => fill('{{usableSheet}}', null)).toThrow('without a catalog')
    expect(() => fill('{{nothing}}', testCatalog)).toThrow('{{nothing}}')
  })

  // A number written by hand in a prompt drifts from the code; the guards catch the known ones.
  it.each(byName)('$name does not restate a value that has a placeholder', ({ raw }) => {
    const restated = Object.entries(values).flatMap(([name, v]) => v!.guards.filter((g) => contains(raw, g)).map((g) => `${name}: ${g}`))
    expect(restated).toEqual([])
  })
})

describe('rendered prompts carry the values the code enforces', () => {
  const skeleton = render(SKELETON, testCatalog)
  const planAdjust = render(PLAN_ADJUSTMENT, testCatalog)

  it('the smallest drawer opening is the one expandDrawer accepts', () => {
    for (const text of [skeleton, planAdjust]) expect(text).toContain(`at least ${MIN_DRAWER_OPENING_HEIGHT} mm high`)
  })

  it('a door takes two leaves past the width the structure check allows', () => {
    expect(skeleton).toContain(`wider than ${ASSUMPTIONS.doors.maxWidth} mm`)
    expect(planAdjust).toContain(`wider than ${ASSUMPTIONS.doors.maxWidth} mm`)
  })

  it('the usable sheet follows the catalog, trim included', () => {
    const t18 = materialById(testCatalog, 'T18')!
    const { length, width } = usableSheet(testCatalog, t18)
    expect(systemFor(RECONSTRUCTION, testCatalog)).toContain(`usable sheet (${length} × ${width} mm: the real sheet is ${t18.sheet.length} × ${t18.sheet.width} and ${testCatalog.layout.trim} mm`)
    const trimmed = { ...testCatalog, layout: { ...testCatalog.layout, trim: 20 } }
    expect(systemFor(RECONSTRUCTION, trimmed)).toContain(`usable sheet (${t18.sheet.length - 40} × ${t18.sheet.width - 40} mm`)
  })

  it('screws: the butt-screw bite and the pocket screw by thickness', () => {
    const system = systemFor(RECONSTRUCTION, testCatalog)
    expect(system).toContain(`bite ${ASSUMPTIONS.screws.minPenetration} mm`)
    expect(system).toContain('is 1" up to 16 mm and 1¼" up to 19 mm.')
  })

  it('mattresses and typical measures come from the domain', () => {
    const [w, l] = MATTRESSES.individual
    expect(systemFor(RECONSTRUCTION, testCatalog)).toContain(`a single bed takes a ${w} × ${l} mm mattress`)
    expect(systemFor(PURCHASE_REVIEW, testCatalog)).toContain(`(double ${MATTRESSES.matrimonial.join(' × ')})`)
    const { width, height, depth } = TYPICAL_TABLE_DIMENSIONS.desk
    expect(skeleton).toContain(`desk ${width} × ${height} × ${depth}.`)
  })

  it('furniture with drawers or doors is anchored from the height the tipping check uses', () => {
    const from = `with drawers or doors`
    expect(skeleton).toContain(`${from} from ${ASSUMPTIONS.tipping.storageHeight} mm high`)
    expect(systemFor(RECONSTRUCTION, testCatalog)).toContain(`${from} is anchored to the wall (\`wallAnchored\`) from ${ASSUMPTIONS.tipping.storageHeight} mm high`)
  })

  it('the default construction is the one the cabinet builder uses', () => {
    const simplest = /use the simplest \(([^)]*)\)/.exec(skeleton)![1]
    expect(simplest.split(', ')).toEqual([
      `doors "${DEFAULT_CONSTRUCTION.doors}"`,
      `drawers "${DEFAULT_CONSTRUCTION.drawerFronts}"`,
      `top "${DEFAULT_CONSTRUCTION.top}"`,
      `back "${DEFAULT_CONSTRUCTION.back}"`,
      `shelves "${DEFAULT_CONSTRUCTION.shelves}"`,
    ])
  })
})

describe('every module reaches the expert', () => {
  const rendered = [render(SKELETON, testCatalog), render(PLAN_ADJUSTMENT, testCatalog)]

  it.each(FURNITURE_KINDS)('%s: its prose is written by hand in both prompts, or generated in both from its module', (kind) => {
    const byHand = WRITTEN_BY_HAND.includes(kind)
    for (const prompt of [SKELETON, PLAN_ADJUSTMENT]) expect({ kind, id: prompt.id, byHand: prompt.text.includes(`goes in \`${kind}\``) }).toEqual({ kind, id: prompt.id, byHand })
    for (const text of rendered) expect(text).toContain(`goes in \`${kind}\``)
  })

  it('a generated section names every field of its plan', () => {
    const [skeleton] = rendered
    for (const kind of FURNITURE_KINDS.filter((k) => !WRITTEN_BY_HAND.includes(k)))
      for (const key of Object.keys((MODULES[kind].schema as unknown as z.ZodObject).shape)) expect(skeleton).toContain(`- \`${key}\``)
  })

  it('names every plan field where it lists them', () => {
    for (const kind of FURNITURE_KINDS) expect(render(PLAN_ADJUSTMENT, testCatalog)).toContain(`\`${kind}\``)
  })
})
