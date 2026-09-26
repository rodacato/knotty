import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { testCatalog } from '../../../domain/furniture/fixtures/catalog.test-util'
import { materialById, usableSheet } from '../../../domain/materials/catalog'
import { MIN_DRAWER_OPENING_HEIGHT } from '../../../domain/editing/operations/drawer'
import { ASSUMPTIONS } from '../../../domain/checks/structure/assumptions'
import { MATTRESSES } from '../../../domain/furniture/modules/bed'
import { TYPICAL_TABLE_DIMENSIONS } from '../../../domain/furniture/modules/table'
import { DEFAULT_CONSTRUCTION } from '../../../domain/furniture/modules/cabinet'
import { FURNITURE_KINDS, MODULE_OF_KIND, MODULES } from '../../../domain/furniture/modules/plan'
import type { DesignKind } from '../../../domain/design/kind'
import { WRITTEN_BY_HAND } from './modulePrompts'
import { KIND_PROMPTS, MODULE_PROMPTS, PLAN_ADJUSTMENT, planAdjustmentFor, PROMPTS, PURCHASE_REVIEW, READING, RECONSTRUCTION, render, SKELETON, skeletonFor, systemFor } from './prompts'
import { strictSchema } from './jsonSchema'
import { planAdjustmentFor as planAdjustmentSchema, PlanResponse, planResponseFor } from '../../../ports/LLMProvider'
import { fill, placeholdersIn, promptValues } from './promptValues'

/** The prompt files as written, by file name. */
const FILES = import.meta.glob<string>('../prompts/**/*.md', { query: '?raw', import: 'default', eager: true })
const byName = Object.entries(FILES).map(([path, raw]) => ({ name: path.split('/').at(-1)!, raw }))

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The literal, not as part of a longer number: "600" does not match "1600" or "600.5". */
const contains = (text: string, literal: string) => new RegExp(`(?<![\\d.])${escape(literal)}(?![\\d.]*\\d)`).test(text)

describe('prompt files', () => {
  it('each file is loaded and named after its id (name@version → name.vversion.md)', () => {
    const loaded = [...PROMPTS.slice(0, 5), SKELETON, PLAN_ADJUSTMENT, ...Object.values(MODULE_PROMPTS), ...Object.values(KIND_PROMPTS)]
    expect(byName.map((f) => f.name).sort()).toEqual(loaded.map((p) => `${p.id.replace('@', '.v')}.md`).sort())
  })

  it('a module has a file exactly when its prose is written by hand', () => {
    expect(Object.keys(MODULE_PROMPTS).sort()).toEqual([...WRITTEN_BY_HAND].sort())
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
  const skeleton = render(skeletonFor(null), testCatalog)
  const planAdjust = render(planAdjustmentFor('cabinet'), testCatalog)

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
  const skeleton = render(skeletonFor(null), testCatalog)

  it.each(FURNITURE_KINDS)('%s: its line in the skeleton is written by hand in its file, or generated from its module', (kind) => {
    expect(MODULE_PROMPTS[kind]?.sections.pick.includes(`goes in \`${kind}\``) ?? false).toBe(WRITTEN_BY_HAND.includes(kind))
    expect(skeleton).toContain(`goes in \`${kind}\``)
  })

  it('a generated section names every field of its plan', () => {
    for (const kind of FURNITURE_KINDS.filter((k) => !WRITTEN_BY_HAND.includes(k)))
      for (const key of Object.keys((MODULES[kind].schema as unknown as z.ZodObject).shape)) expect(skeleton).toContain(`- \`${key}\``)
  })
})

describe('the skeleton asks only about the module the furniture is known to be', () => {
  it('without a kind it lists every module and carries every guide, as it always did', () => {
    const generic = skeletonFor(null)
    expect(generic.id).toBe(`${SKELETON.id}+all`)
    for (const kind of WRITTEN_BY_HAND) for (const part of ['pick', 'skeleton'] as const) expect(generic.text).toContain(MODULE_PROMPTS[kind]!.sections[part])
    expect(generic.text).toContain('Fill only the one that fits best')
  })

  it.each(FURNITURE_KINDS)('%s: its prompt and schema name its field and no other module', (kind) => {
    const prompt = skeletonFor(kind)
    const text = render(prompt, testCatalog)
    const schema = JSON.stringify(strictSchema(planResponseFor(kind)))
    expect(prompt.id).toBe(`${SKELETON.id}+${WRITTEN_BY_HAND.includes(kind) ? MODULE_PROMPTS[kind]!.id : `${kind}@auto`}`)
    expect(text).toContain(`goes in \`${kind}\``)
    expect(text).toContain(`Fill \`${kind}\` with its plan`)
    expect(text).toContain('## Everything else')
    for (const other of FURNITURE_KINDS.filter((k) => k !== kind)) {
      expect(text).not.toContain(`goes in \`${other}\``)
      expect(text).not.toContain(`(\`${other}\`)`)
      expect(schema).not.toContain(`"${other}":`)
    }
  })

  it.each(WRITTEN_BY_HAND)('%s: its hand-written line and guide are sent whole', (kind) => {
    const { pick, skeleton } = MODULE_PROMPTS[kind]!.sections
    expect(skeletonFor(kind).text).toContain(pick)
    expect(skeletonFor(kind).text).toContain(skeleton)
  })
})

describe('a guide by use joins its module when the furniture is known to be that use', () => {
  it('every guide is for a kind that has a module', () => {
    for (const use of Object.keys(KIND_PROMPTS) as DesignKind[]) expect({ use, module: MODULE_OF_KIND[use] }).toEqual({ use, module: expect.any(String) })
  })

  it('a sideboard gets its guide in the skeleton and in plan-adjust, after its module, and says so in the id', () => {
    const guide = KIND_PROMPTS.sideboard!
    const skeleton = skeletonFor('cabinet', 'sideboard')
    expect(skeleton.id).toBe(`${SKELETON.id}+${MODULE_PROMPTS.cabinet!.id}+${guide.id}`)
    expect(skeleton.text.indexOf(guide.text)).toBeGreaterThan(skeleton.text.indexOf(MODULE_PROMPTS.cabinet!.sections.skeleton))
    expect(skeleton.text.indexOf(guide.text)).toBeLessThan(skeleton.text.indexOf('## Everything else'))
    const adjust = planAdjustmentFor('cabinet', 'sideboard')
    expect(adjust.id).toBe(`${PLAN_ADJUSTMENT.id}+${MODULE_PROMPTS.cabinet!.id}+${guide.id}`)
    expect(adjust.text).toContain(guide.text)
  })

  it('a use without a guide, another module’s use or no module at all leave the prompt as it was', () => {
    expect(skeletonFor('cabinet', 'bookcase')).toEqual(skeletonFor('cabinet'))
    expect(skeletonFor('bed', 'sideboard')).toEqual(skeletonFor('bed'))
    expect(skeletonFor(null, 'sideboard')).toEqual(skeletonFor(null))
    expect(planAdjustmentFor('table', 'sideboard')).toEqual(planAdjustmentFor('table'))
  })
})

describe('adjusting a plan asks only about its own module', () => {
  it.each(FURNITURE_KINDS)('%s: its prompt and schema name its field and no other module', (kind) => {
    const prompt = planAdjustmentFor(kind)
    const text = render(prompt, testCatalog)
    const schema = JSON.stringify(strictSchema(planAdjustmentSchema(kind)))
    expect(text).toContain(`goes in \`${kind}\``)
    expect(text).toContain(`Return in \`${kind}\` the **complete** plan`)
    expect(prompt.id).toBe(`${PLAN_ADJUSTMENT.id}+${WRITTEN_BY_HAND.includes(kind) ? MODULE_PROMPTS[kind]!.id : `${kind}@auto`}`)
    for (const other of FURNITURE_KINDS.filter((k) => k !== kind)) {
      expect(text).not.toContain(`goes in \`${other}\``)
      expect(schema).not.toContain(`"${other}":`)
    }
  })

  it('the hand-written prose of each module is sent whole: its description, what can change and its rules', () => {
    for (const kind of WRITTEN_BY_HAND) {
      const text = planAdjustmentFor(kind).text
      const { plan, changes, rules } = MODULE_PROMPTS[kind]!.sections
      expect(text).toContain(plan)
      expect(text).toContain(`(${changes})`)
      for (const rule of (rules ?? '').split('\n').filter(Boolean)) expect(text).toContain(`  ${rule}`)
    }
  })
})

/** The prompt and the schema of its answer, as characters ÷ 3.5: a guard against growth, not a count. The provider counts ≈ 1.7–1.9 × this (npm run compare, 2026-09-26). */
const approxTokens = (text: string) => Math.round(text.length / 3.5)

/** About 5 % above what each measured when it was set (plan-adjust@12): growing past it has to be on purpose. With every module it was 4 307. */
const PLAN_ADJUST_BUDGET: Record<(typeof FURNITURE_KINDS)[number], number> = { cabinet: 2420, bed: 2060, table: 1870, shoeRack: 1930 }

/** Skeleton prompt and schema, measured the same way (skeleton@15); with every module it is the same as skeleton@14 was. */
const SKELETON_BUDGET: Record<(typeof FURNITURE_KINDS)[number] | 'all', number> = { all: 5670, cabinet: 2815, bed: 2105, table: 1840, shoeRack: 1960 }

/** With the guide of its use, measured the same way (sideboard@1). */
const GUIDED_BUDGET: Partial<Record<DesignKind, { skeleton: number; adjust: number }>> = { sideboard: { skeleton: 3080, adjust: 2690 } }

describe('token budget', () => {
  it.each(Object.keys(GUIDED_BUDGET) as DesignKind[])('with the %s guide: skeleton and plan-adjust within budget', (use) => {
    const module = MODULE_OF_KIND[use]!
    const skeleton = approxTokens(render(skeletonFor(module, use), testCatalog)) + approxTokens(JSON.stringify(strictSchema(planResponseFor(module))))
    const adjust = approxTokens(render(planAdjustmentFor(module, use), testCatalog)) + approxTokens(JSON.stringify(strictSchema(planAdjustmentSchema(module))))
    expect(skeleton).toBeLessThanOrEqual(GUIDED_BUDGET[use]!.skeleton)
    expect(adjust).toBeLessThanOrEqual(GUIDED_BUDGET[use]!.adjust)
  })

  it.each([null, ...FURNITURE_KINDS])('the skeleton for %s: prompt and schema within budget', (kind) => {
    const sent = approxTokens(render(skeletonFor(kind), testCatalog)) + approxTokens(JSON.stringify(strictSchema(kind ? planResponseFor(kind) : PlanResponse)))
    expect(sent).toBeLessThanOrEqual(SKELETON_BUDGET[kind ?? 'all'])
  })

  it.each(FURNITURE_KINDS)('adjusting a %s plan: prompt and schema within budget', (kind) => {
    const sent = approxTokens(render(planAdjustmentFor(kind), testCatalog)) + approxTokens(JSON.stringify(strictSchema(planAdjustmentSchema(kind))))
    expect(sent).toBeLessThanOrEqual(PLAN_ADJUST_BUDGET[kind])
  })
})
