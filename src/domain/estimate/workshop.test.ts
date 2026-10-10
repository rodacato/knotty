import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { testCatalog } from '../furniture/fixtures/catalog.test-util'
import { buildPlan, MODULES, type FurniturePlan } from '../furniture/modules/plan'
import { REFERENCED, ROOT, sourceProblem } from '../sources.test-util'
import { atTheYard, toolsFor } from './workshop'

const designs = Object.values(MODULES).flatMap((m) => (m.benchVariants() as [string, FurniturePlan][]).map(([name, plan]) => ({ name, design: buildPlan(plan, testCatalog).design })))
const all = [...new Map(designs.flatMap(({ design }) => [...atTheYard(design), ...toolsFor(design)]).map((a) => [a.text, a])).values()]
const of = (name: string) => designs.find((d) => d.name === name)!.design
const texts = (list: { text: string }[]) => list.map((a) => a.text).join(' ')

function citedLine(source: string): string {
  const [, path, , row] = source.match(REFERENCED)!
  return readFileSync(join(ROOT, path), 'utf8').split('\n').find((line) => line.includes(row))!
}

describe('what to ask the lumberyard for and what to have at hand', () => {
  it.each(all)('«$text» cites a row of the reference that is there', ({ source }) => {
    expect(sourceProblem(source)).toBeNull()
  })

  it('no line carries a number its row does not have, nor promises a load', () => {
    expect(all.flatMap((a) => (a.text.match(/\d+/g) ?? []).filter((n) => !citedLine(a.source).includes(n)).map((n) => `${n}: ${a.text}`))).toEqual([])
    expect(all.filter((a) => /\bkg\b|aguanta|soporta|resiste|garant/i.test(a.text)).map((a) => a.text)).toEqual([])
  })

  it('asks for the cuts of any design, and for hinge cups only where there are hinged doors', () => {
    expect(designs.filter(({ design }) => !/cortes rectos/.test(texts(atTheYard(design)))).map((d) => d.name)).toEqual([])
    const hinged = (design: (typeof designs)[number]['design']) => design.joints.some((u) => u.type === 'cup-hinge')
    expect(designs.filter(({ design }) => hinged(design) !== /bisagras/.test(texts(atTheYard(design)))).map((d) => d.name)).toEqual([])
    expect(designs.filter(({ design }) => hinged(design) !== /cazoletas/.test(texts(toolsFor(design)))).map((d) => d.name)).toEqual([])
  })

  it('lists glue only for a design with a glued joint', () => {
    expect(designs.filter(({ design }) => design.joints.some((u) => u.glue) !== /pegamento/.test(texts(toolsFor(design)))).map((d) => d.name)).toEqual([])
  })

  it('names the tool of a joint only for a design that has that joint', () => {
    const has = (design: (typeof designs)[number]['design'], type: string) => design.joints.some((u) => u.type === type)
    expect(designs.filter(({ design }) => has(design, 'pocket-screw') !== /Plantilla de bolsillo/.test(texts(toolsFor(design)))).map((d) => d.name)).toEqual([])
    expect(designs.filter(({ design }) => has(design, 'connector-bolt') !== /llave Allen/.test(texts(toolsFor(design)))).map((d) => d.name)).toEqual([])
    expect(texts(toolsFor(of('comedor largo, desarmable con pernos')))).toMatch(/llave Allen/)
    expect(texts(toolsFor(of('comedor con patas')))).toMatch(/Plantilla de bolsillo/)
  })
})
