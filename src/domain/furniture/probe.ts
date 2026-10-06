import { z } from 'zod'
import { analyze } from '../checks/analysis'
import type { Catalog } from '../materials/catalog'
import { estimatePurchase } from '../estimate/purchase'
import { exampleDesign, exampleOf } from './examples'
import type { Reference } from './references'

// What a ficha comes to when the engine builds it: the few figures a carpenter would check, kept in the file as `expect` so a change in the engine shows up as a difference.

export const Expect = z
  .object({
    valid: z.boolean(),
    pieces: z.number().int().nonnegative(),
    /** `severity:code` of every finding, or `error:code` when the design is not valid; sorted, and repeated when it is. */
    findings: z.array(z.string()),
    /** Sheets to buy by material. */
    sheets: z.record(z.string(), z.number().int()),
    /** Units of hardware by id. */
    hardware: z.record(z.string(), z.number().int()),
  })
  .strict()
export type Expect = z.infer<typeof Expect>

const sorted = (words: string[]) => [...words].sort()
const byKey = <T>(entries: [string, T][]) => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)))

/** What the engine makes of a reference, in the terms of `Expect`. */
export function probe(reference: Reference, catalog: Catalog): Expect {
  const { design } = exampleDesign(exampleOf(reference), catalog)
  const analysis = analyze(design, catalog)
  if (!analysis.valid) return { valid: false, pieces: design.pieces.length, findings: sorted(analysis.errors.map((e) => `error:${e.code}`)), sheets: {}, hardware: {} }
  const purchase = estimatePurchase(design, analysis.geo, catalog)
  return {
    valid: true,
    pieces: design.pieces.length,
    findings: sorted(analysis.findings.map((f) => `${f.severity}:${f.code}`)),
    sheets: byKey(purchase.sheets.map((s) => [s.material.id, s.sheets])),
    hardware: byKey(purchase.hardware.map((h) => [h.hardware.id, h.count])),
  }
}

const show = (x: unknown) => JSON.stringify(x)

/** What is not as the ficha expects, one line each; empty when it matches. */
export function differences(expected: Expect, actual: Expect): string[] {
  const lines: string[] = []
  if (expected.valid !== actual.valid) lines.push(`valid: expected ${expected.valid}, got ${actual.valid}`)
  if (expected.pieces !== actual.pieces) lines.push(`pieces: expected ${expected.pieces}, got ${actual.pieces}`)
  if (show(expected.findings) !== show(actual.findings)) lines.push(`findings: expected ${show(expected.findings)}, got ${show(actual.findings)}`)
  for (const key of ['sheets', 'hardware'] as const) {
    for (const id of [...new Set([...Object.keys(expected[key]), ...Object.keys(actual[key])])].sort()) {
      if (expected[key][id] !== actual[key][id]) lines.push(`${key}.${id}: expected ${expected[key][id] ?? 'none'}, got ${actual[key][id] ?? 'none'}`)
    }
  }
  return lines
}

/** What the engine made of a plan, in one line, for a person reading `probe`: «valid, 55 pieces, findings: critical:R4_TIPPING». */
export const describeExpect = (e: Expect) => `${e.valid ? 'valid' : 'NOT valid'}, ${e.pieces} pieces, findings: ${e.findings.length ? e.findings.join(' ') : 'none'}`
