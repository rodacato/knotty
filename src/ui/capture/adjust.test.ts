import { describe, expect, it } from 'vitest'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { exampleSideboard } from '../../domain/furniture/fixtures/references.test-util'
import { fitToSpace, summarizePlan } from '../../domain/furniture/quick'
import type { Base } from '../../domain/furniture/examples'
import { axisNote, blocking, chosenExample, costLine, isUnreadable, parseCm, sheetsLine, spaceOf, summaryLines } from './adjust'

describe('parseCm', () => {
  it('reads whole and decimal centimeters as mm, with a comma or a point', () => {
    expect(parseCm('90')).toBe(900)
    expect(parseCm(' 37.5 ')).toBe(375)
    expect(parseCm('37,5')).toBe(375)
  })
  it('gives nothing for empty, zero or text', () => {
    for (const text of ['', '  ', '0', 'abc', '90 cm', '-5', '1e3']) expect(parseCm(text)).toBeNull()
  })
})

describe('spaceOf and isUnreadable', () => {
  it('keeps only the axes with a number', () => {
    expect(spaceOf({ width: '150', depth: '', height: 'x' })).toEqual({ width: 1500 })
  })
  it('flags what was typed but cannot be read, not what is empty', () => {
    expect(isUnreadable('x')).toBe(true)
    expect(isUnreadable('')).toBe(false)
    expect(isUnreadable('90')).toBe(false)
  })
})

describe('axisNote', () => {
  const axis = { asked: 1573, proposed: 1570, min: 600, max: 2400, status: 'rounded-down' as const }
  it('says what a rounded axis became and what a limit did', () => {
    expect(axisNote(axis)).toBe('queda en 157 cm.')
    expect(axisNote({ ...axis, asked: 300, proposed: 600, status: 'raised' })).toBe('lo más bajo que da es 60 cm: queda en 60 cm y no cabe.')
    expect(axisNote({ ...axis, asked: 3000, proposed: 2400, status: 'lowered' })).toBe('lo más que da es 240 cm: queda en 240 cm.')
  })
  it('says nothing when the space was taken as given or not given', () => {
    expect(axisNote({ ...axis, status: 'as-asked' })).toBeNull()
    expect(axisNote({ ...axis, asked: null, status: 'kept' })).toBeNull()
  })
})

describe('the summary lines', () => {
  it('agrees in number and writes pesos', () => {
    expect(sheetsLine(1)).toBe('1 hoja de triplay')
    expect(sheetsLine(4)).toBe('4 hojas de triplay')
    expect(costLine(6059.6)).toBe('~$6,060')
  })
  it('come from the plan summary and are absent when the plan does not build', () => {
    const summary = summarizePlan(exampleSideboard.plan, testCatalog, 'polyurethane')
    expect(summaryLines(summary)).toEqual({ sheets: sheetsLine(summary.ok ? summary.totalSheets : 0), cost: costLine(summary.ok ? summary.cost : 0) })
    expect(summaryLines({ ok: false, problems: ['x'] })).toBeNull()
  })
})

describe('the fit and the example the Studio opens', () => {
  const base = { ...exampleSideboard, id: 'sideboard', rooms: ['living'], style: 'basic', code: 'GN-X', version: 1 } satisfies Base
  it('blocks opening only when the plan does not build as asked', () => {
    expect(blocking(fitToSpace(base.plan, { width: 1500 }, testCatalog))).toBeNull()
  })
  it('carries the fitted plan and the finish chosen, and keeps the base`s name', () => {
    const fit = fitToSpace(base.plan, { width: 1500 }, testCatalog)
    const example = chosenExample(base, fit.plan, 'lacquer')
    expect(example).toMatchObject({ name: base.name, finish: 'lacquer', plan: { dimensions: { width: 1500 } } })
  })
})
