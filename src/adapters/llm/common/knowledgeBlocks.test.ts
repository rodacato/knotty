import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../../domain/furniture/fixtures/catalog.test-util'
import type { KnowledgeSelection } from '../../../domain/furniture/knowledge/select'
import { TOOL_LEVELS } from '../../../domain/materials/tools'
import { DEFAULT_CONSTRUCTION } from '../../../domain/furniture/modules/cabinet'
import { FURNITURE_KINDS } from '../../../domain/furniture/modules/plan'
import { ADJUSTMENT, KIND_PROMPTS, MODULE_PROMPTS, PLAN_ADJUSTMENT, guideBlock, PURCHASE_REVIEW, RECONSTRUCTION, READING, SKELETON, CRAFT_CORE, CRAFT_TOOLS, craftBlock, planAdjustmentFor, promptIdOf, readingFor, render, skeletonFor, systemFor } from './prompts'
import { createExpert, type Transport } from './expert'

const full: KnowledgeSelection = { core: 'full', guide: null, guideSize: 'full', tools: 3 }
const short: KnowledgeSelection = { core: 'short', guide: null, guideSize: 'short', tools: 1 }
const photo: KnowledgeSelection = { core: 'photo', guide: null, guideSize: 'short', tools: null }
const signal = new AbortController().signal
const approxTokens = (text: string) => Math.round(text.length / 3.5)

const sentences = (text: string) => text.split('\n').flatMap((line) => line.split(/(?<=\.|:) (?=[A-Z])/))

describe('the craft blocks', () => {
  it('every shorter core is made of sentences of the full one', () => {
    for (const size of ['photo', 'short'] as const) for (const sentence of sentences(CRAFT_CORE.sections[size])) expect(CRAFT_CORE.sections.full).toContain(sentence)
  })

  it('every tool level has its section, and the photo carries the core alone', () => {
    for (const level of TOOL_LEVELS) expect(CRAFT_TOOLS.sections[level]).toMatch(/^Tools: /)
    expect(craftBlock(photo)).toEqual({ id: CRAFT_CORE.id, text: CRAFT_CORE.sections.photo })
    expect(craftBlock({ ...photo, tools: 2 })!.text).toBe(CRAFT_CORE.sections.photo)
    expect(CRAFT_CORE.sections.photo.split('\n').length).toBeLessThanOrEqual(3)
  })

  it('without a selection there is no block', () => {
    expect(craftBlock(null)).toBeNull()
    expect(craftBlock(undefined)).toBeNull()
  })

  it('the core comes first and the tools of the person’s level after it', () => {
    for (const level of TOOL_LEVELS) {
      const block = craftBlock({ ...short, tools: level })!
      expect(block.id).toBe(`${CRAFT_CORE.id}+${CRAFT_TOOLS.id}`)
      expect(block.text).toBe(`${CRAFT_CORE.sections.short}\n\n${CRAFT_TOOLS.sections[level]}`)
    }
    expect(craftBlock({ ...short, tools: null })!.id).toBe(CRAFT_CORE.id)
  })
})

describe('a prompt with no selection is exactly what it was', () => {
  it.each([null, undefined])('%s: same text and id for every call', (none) => {
    expect(skeletonFor(null, null, none)).toEqual(skeletonFor(null))
    for (const kind of FURNITURE_KINDS) {
      expect(skeletonFor(kind, null, none)).toEqual(skeletonFor(kind))
      expect(planAdjustmentFor(kind, null, none)).toEqual(planAdjustmentFor(kind))
    }
    expect(readingFor(none)).toEqual(READING)
    for (const task of [RECONSTRUCTION, ADJUSTMENT, PURCHASE_REVIEW]) {
      expect(systemFor(task, testCatalog, none)).toBe(systemFor(task, testCatalog))
      expect(promptIdOf(task, none)).toBe(promptIdOf(task))
    }
  })
})

describe('a selection adds its blocks last and says so in the id', () => {
  const block = (k: KnowledgeSelection) => craftBlock(k)!

  it.each([
    ['skeleton without a kind', (k?: KnowledgeSelection) => skeletonFor(null, null, k), `${SKELETON.id}+all`],
    ['skeleton of a module', (k?: KnowledgeSelection) => skeletonFor('cabinet', null, k), skeletonFor('cabinet').id],
    ['plan-adjust', (k?: KnowledgeSelection) => planAdjustmentFor('cabinet', null, k), planAdjustmentFor('cabinet').id],
  ])('%s', (_, prompt, base) => {
    for (const k of [full, short]) {
      const sent = prompt(k)
      expect(sent.id).toBe(`${base}+${block(k).id}`)
      expect(sent.text).toBe(`${prompt().text}\n\n${block(k).text}`)
    }
  })

  it('the system prompt and the task keep their place and the blocks follow', () => {
    for (const task of [RECONSTRUCTION, ADJUSTMENT, PURCHASE_REVIEW]) {
      expect(systemFor(task, testCatalog, full)).toBe(`${systemFor(task, testCatalog)}\n\n${block(full).text}`)
      expect(promptIdOf(task, full)).toBe(`${promptIdOf(task)}+core@2+tools@1`)
    }
  })

  it('the photo reading gets the photo core only, whatever else the selection says', () => {
    for (const k of [photo, full, short]) expect(readingFor(k)).toEqual({ id: `${READING.id}+${CRAFT_CORE.id}`, text: `${READING.text}\n\n${CRAFT_CORE.sections.photo}` })
    expect(readingFor(full).text).not.toContain('Tools:')
  })
})

describe('the guide of a use reaches the system-prompt calls last, by size', () => {
  const guide = KIND_PROMPTS.bookcase!
  const guided = (k: KnowledgeSelection): KnowledgeSelection => ({ ...k, guide: 'bookcase' })
  const calls = [
    [RECONSTRUCTION, 'full'],
    [ADJUSTMENT, 'short'],
    [PURCHASE_REVIEW, 'short'],
  ] as const

  it('the file keeps its body as the full text and its `# short` section apart', () => {
    expect(guide.short).toMatch(/^A bookcase holds books/)
    expect(guide.text).not.toContain('# short')
    expect(guide.text).not.toContain(guide.short!)
    expect(KIND_PROMPTS.sideboard!.short).toBeNull()
  })

  it.each(calls)('%#: core, then tools, then the guide at its size, and the id says so in that order', (task, size) => {
    const k = guided({ ...(size === 'full' ? full : short), guideSize: size })
    const text = systemFor(task, testCatalog, k)
    const body = size === 'full' ? guide.text : guide.short!
    expect(text.endsWith(`\n\n${body}`)).toBe(true)
    expect(text.indexOf(craftBlock(k)!.text)).toBeLessThan(text.lastIndexOf(body))
    expect(text.indexOf(CRAFT_CORE.sections[k.core])).toBeLessThan(text.indexOf(CRAFT_TOOLS.sections[String(k.tools)]))
    expect(text.indexOf(CRAFT_TOOLS.sections[String(k.tools)])).toBeLessThan(text.lastIndexOf(body))
    expect(promptIdOf(task, k)).toBe(`${promptIdOf(task, { ...k, guide: null })}+bookcase@1`)
    expect(promptIdOf(task, k)).toMatch(/\+core@2\+tools@1\+bookcase@1$/)
  })

  it('without a guide in the selection nothing is added, with or without craft blocks', () => {
    for (const k of [full, short]) for (const [task] of calls) expect(systemFor(task, testCatalog, k)).toBe(`${systemFor(task, testCatalog)}\n\n${craftBlock(k)!.text}`)
  })

  it('a short guide never carries the full body and a full one never the short text', () => {
    for (const [task] of calls) {
      expect(systemFor(task, testCatalog, guided({ ...short, guideSize: 'short' }))).not.toContain(guide.text)
      expect(systemFor(task, testCatalog, guided({ ...full, guideSize: 'full' }))).not.toContain(guide.short!)
    }
  })

  it('a guide without a `# short` section sends nothing extra to adjust and review, and its full body goes to reconstruct', () => {
    const k: KnowledgeSelection = { ...short, guide: 'sideboard', guideSize: 'short' }
    expect(guideBlock('sideboard', 'short')).toBeNull()
    for (const task of [ADJUSTMENT, PURCHASE_REVIEW]) {
      expect(systemFor(task, testCatalog, k)).toBe(systemFor(task, testCatalog, { ...k, guide: null }))
      expect(promptIdOf(task, k)).toBe(promptIdOf(task, { ...k, guide: null }))
    }
    expect(promptIdOf(RECONSTRUCTION, { ...full, guide: 'sideboard' })).toMatch(/\+tools@1\+sideboard@3$/)
  })

  it('skeleton and plan-adjust keep their own place and ids, and never the short text', () => {
    const k = guided({ ...full, guideSize: 'full' })
    expect(skeletonFor('cabinet', 'bookcase', k).id).toBe(`${SKELETON.id}+${MODULE_PROMPTS.cabinet!.id}+bookcase@1+${craftBlock(k)!.id}`)
    expect(planAdjustmentFor('cabinet', 'bookcase', k).id).toBe(`${PLAN_ADJUSTMENT.id}+${MODULE_PROMPTS.cabinet!.id}+bookcase@1+${craftBlock(k)!.id}`)
    for (const sent of [skeletonFor('cabinet', 'bookcase', k), planAdjustmentFor('cabinet', 'bookcase', k)]) {
      expect(sent.text).toContain(guide.text)
      expect(sent.text).not.toContain(guide.short!)
      expect(sent.text.split(guide.text)).toHaveLength(2)
    }
  })

  it('the photo reading never gets a guide', () => {
    expect(readingFor({ ...photo, guide: 'bookcase' })).toEqual(readingFor(photo))
  })

  it('what it adds stays small', () => {
    const GUIDE_DELTA = { reconstruct: 560, adjust: 280, review: 280 }
    const added = (task: typeof RECONSTRUCTION, k: KnowledgeSelection) => approxTokens(systemFor(task, testCatalog, k)) - approxTokens(systemFor(task, testCatalog, { ...k, guide: null }))
    expect(added(RECONSTRUCTION, guided({ ...full, guideSize: 'full' }))).toBeLessThanOrEqual(GUIDE_DELTA.reconstruct)
    expect(added(ADJUSTMENT, guided({ ...short, guideSize: 'short' }))).toBeLessThanOrEqual(GUIDE_DELTA.adjust)
    expect(added(PURCHASE_REVIEW, guided({ ...short, guideSize: 'short' }))).toBeLessThanOrEqual(GUIDE_DELTA.review)
  })
})

describe('what a selection adds to each call stays small', () => {
  /** About 10 % above what each block measured when set (core@2, tools@1), characters ÷ 3.5. */
  const DELTA_BUDGET = { reconstruct: 560, skeleton: 560, adjust: 450, planAdjust: 450, review: 450, reading: 40 }
  const added = (sent: string, plain: string) => approxTokens(sent) - approxTokens(plain)

  it('reconstruct, skeleton, adjust, plan-adjust, review and reading', () => {
    const level1 = { ...full, tools: 1 as const }
    const shortLevel1 = { ...short, tools: 1 as const }
    const heaviest = (k: KnowledgeSelection) => [1, 2, 3].map((tools) => ({ ...k, tools: tools as 1 | 2 | 3 }))
    for (const k of heaviest(level1)) {
      expect(added(systemFor(RECONSTRUCTION, testCatalog, k), systemFor(RECONSTRUCTION, testCatalog))).toBeLessThanOrEqual(DELTA_BUDGET.reconstruct)
      expect(added(render(skeletonFor('cabinet', null, k), testCatalog), render(skeletonFor('cabinet'), testCatalog))).toBeLessThanOrEqual(DELTA_BUDGET.skeleton)
    }
    for (const k of heaviest(shortLevel1)) {
      expect(added(systemFor(ADJUSTMENT, testCatalog, k), systemFor(ADJUSTMENT, testCatalog))).toBeLessThanOrEqual(DELTA_BUDGET.adjust)
      expect(added(render(planAdjustmentFor('cabinet', null, k), testCatalog), render(planAdjustmentFor('cabinet'), testCatalog))).toBeLessThanOrEqual(DELTA_BUDGET.planAdjust)
      expect(added(systemFor(PURCHASE_REVIEW, testCatalog, k), systemFor(PURCHASE_REVIEW, testCatalog))).toBeLessThanOrEqual(DELTA_BUDGET.review)
    }
    expect(added(render(readingFor(photo), null), render(READING, null))).toBeLessThanOrEqual(DELTA_BUDGET.reading)
  })

  it('even the heaviest prompt with every block stays under 64 KiB', () => {
    for (const task of [RECONSTRUCTION, ADJUSTMENT, PURCHASE_REVIEW]) expect(new TextEncoder().encode(systemFor(task, testCatalog, full)).length).toBeLessThan(64 * 1024)
  })
})

describe('the expert sends the blocks of the selection it was given', () => {
  const state = { measures: null, photos: [], notes: 'un librero', reading: null, catalog: testCatalog, correction: null }
  const plan = { kind: 'cabinet' as const, name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, material: 'T18', base: 'floor' as const, legHeight: 150, wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [] }
  type Expert = ReturnType<typeof createExpert>
  const calls = [
    ['reconstruct', (e: Expert, k?: KnowledgeSelection) => e.reconstruct({ ...state, knowledge: k }, signal)],
    ['planDesign', (e: Expert, k?: KnowledgeSelection) => e.planDesign!({ ...state, knowledge: k }, signal)],
    ['proposeAdjustment', (e: Expert, k?: KnowledgeSelection) => e.proposeAdjustment({ context: 'c', request: 'más ancho', design: exampleBookcase, proposal: null, catalog: testCatalog, correction: null, knowledge: k }, signal)],
    ['adjustPlan', (e: Expert, k?: KnowledgeSelection) => e.adjustPlan!({ context: 'c', request: 'x', plan, catalog: testCatalog, correction: null, knowledge: k }, signal)],
    ['reviewPurchase', (e: Expert, k?: KnowledgeSelection) => e.reviewPurchase({ context: 'c', review: 'r', design: exampleBookcase, checks: [], catalog: testCatalog, knowledge: k }, signal)],
    ['readPhoto', (e: Expert, k?: KnowledgeSelection) => e.readPhoto({ photo: { base64: 'abc' }, context: 'c', knowledge: k }, signal)],
  ] as const

  async function sent(run: (typeof calls)[number][1], k?: KnowledgeSelection) {
    const seen: string[] = []
    const transport: Transport = {
      provider: 'test',
      model: 'm',
      async completeJSON(system) {
        seen.push(system)
        return { json: {}, usage: {} }
      },
    }
    await run(createExpert(transport, 'Test'), k).catch(() => {})
    return seen[0]
  }

  it.each(calls)('%s: with a selection its prompt ends in the blocks, without one it does not', async (_, run) => {
    const plain = await sent(run)
    const withBlocks = await sent(run, short)
    const photoOnly = _ === 'readPhoto'
    expect(plain).not.toContain('Craft sense.')
    expect(withBlocks).toBe(`${plain}\n\n${photoOnly ? CRAFT_CORE.sections.photo : craftBlock(short)!.text}`)
  })
})
