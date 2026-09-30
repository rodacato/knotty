import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createBundledReferences } from '../../src/adapters/references/store'
import { formatFicha } from '../../src/adapters/references/format'
import { Catalog } from '../../src/domain/materials/catalog'
import { prepareAdoption } from '../../src/domain/furniture/adopt'
import { explain, linesChanged } from '../../src/domain/furniture/explain'
import { describeExpect, differences, probe, type Expect } from '../../src/domain/furniture/probe'
import { loadReferences, ReferenceFile, type Reference } from '../../src/domain/furniture/references'

// Checks a ficha against what the engine makes of it. Usage:
//   npm run probe -- kc-apa-01            one ficha, in detail
//   npm run probe -- --all                every ficha, one line each
//   npm run probe -- --update kc-apa-01   rewrite its `expect` (and only that) to what the engine makes
//   npm run probe -- --explain kc-apa-01  a ficha in words (or, with a candidate.json after it, the candidate as it would be adopted)
//   npm run probe -- --diff kc-apa-01 candidate.json    what a candidate would change, writing nothing
//   npm run probe -- --adopt kc-apa-01 candidate.json   make it the next version (or version 1 of a new reference)
// A candidate is a plan, or a ficha without `expect`; over an existing reference it inherits what it does not say.

const DIR = 'src/adapters/references'
const catalog = Catalog.parse(JSON.parse(readFileSync('public/catalog/catalog.json', 'utf8')))
const store = createBundledReferences()

const fileOf = (r: Reference) => `${DIR}/${r.code.toLowerCase()}.v${r.version}.json`

/** What is wrong with one ficha, empty when it is right. */
function problems(r: Reference): string[] {
  const text = readFileSync(fileOf(r), 'utf8')
  const notCanonical = formatFicha(JSON.parse(text)) === text ? [] : ['the file is not written as probe writes it: run probe --update']
  return [...differences(r.expect, probe(r, catalog)), ...notCanonical]
}

/** What adopting a candidate would do, from the files on disk; prints why and returns null when it cannot. */
function plan(code: string, candidateFile: string) {
  const upper = code.toUpperCase()
  const existing = store.latest(upper)
  const current = existing ? { file: JSON.parse(readFileSync(fileOf(existing), 'utf8')) as Record<string, unknown>, version: existing.version } : null
  const candidate = JSON.parse(readFileSync(candidateFile, 'utf8')) as Record<string, unknown>
  const adoption = prepareAdoption(current, candidate, upper, catalog)
  if (!adoption.ok) {
    console.error(`✗ ${upper}: not adopted\n${adoption.reasons.map((r) => `  ${r}`).join('\n')}`)
    return null
  }
  return { upper, existing, adoption }
}

/** A ficha file as words; the parse also proves it is a ficha. */
const explainOf = (ficha: Record<string, unknown>, code: string, version: number) => explain({ ...ReferenceFile.parse(ficha), code, version })

const report = ({ upper, existing, adoption }: NonNullable<ReturnType<typeof plan>>) => {
  console.log(existing ? `${upper}: version ${existing.version}${adoption.changes.length ? ` → ${adoption.version}` : ', nothing new'}` : `${upper}: new reference, version 1`)
  for (const path of adoption.changes) console.log(`  changed ${path}`)
  for (const line of adoption.expectChanges) console.log(`  expect ${line}`)
  // Always the verdict, also for a new reference: «accepted» alone says nothing about whether the engine likes it.
  const made = adoption.ficha.expect as Expect
  console.log(`  engine: ${describeExpect(made)}`)
  if (existing) {
    const changed = linesChanged(explain(existing), explainOf(adoption.ficha, upper, adoption.version))
    if (changed.length) console.log(`  reading:\n${changed.map((l) => `    ${l}`).join('\n')}`)
  }
  if (made.findings.some((f) => f.startsWith('critical:'))) console.log('  ⚠ a critical finding: check the plan (an anchor missing, a base, a span) before adopting it')
}

const find = (code: string) => {
  const found = store.latest(code.toUpperCase())
  if (!found) throw new Error(`No reference ${code}. There are ${store.all().map((r) => r.code).join(', ')}.`)
  return found
}

export async function main(args: string[]): Promise<number> {
  try {
    if (args[0] === '--all') {
      let bad = 0
      for (const r of store.all()) {
        const issues = problems(r)
        bad += issues.length ? 1 : 0
        const actual = probe(r, catalog)
        console.log(`${issues.length ? '✗' : '✓'} ${r.code}@${r.version}  ${actual.valid ? 'valid' : 'INVALID'}  ${actual.pieces} pieces  ${actual.findings.length} findings`)
        for (const line of issues) console.log(`    ${line}`)
      }
      return bad ? 1 : 0
    }
    if (args[0] === '--update') {
      const r = find(args[1] ?? '')
      const file = JSON.parse(readFileSync(fileOf(r), 'utf8')) as Record<string, unknown>
      writeFileSync(fileOf(r), formatFicha({ ...file, expect: probe(r, catalog) }))
      console.log(`${fileOf(r)}: expect written`)
      return 0
    }
    if (args[0] === '--explain') {
      if (!args[1]) throw new Error('Usage: npm run probe -- --explain <code> [candidate.json]')
      if (!args[2]) {
        const r = find(args[1])
        console.log(explain({ ...r, expect: probe(r, catalog) }))
        return 0
      }
      const p = plan(args[1], args[2])
      if (!p) return 1
      console.log(explainOf(p.adoption.ficha, p.upper, p.adoption.version))
      return 0
    }
    if (args[0] === '--diff' || args[0] === '--adopt') {
      if (!args[1] || !args[2]) throw new Error(`Usage: npm run probe -- ${args[0]} <code> <candidate.json>`)
      const p = plan(args[1], args[2])
      if (!p) return 1
      report(p)
      if (args[0] === '--diff' || !p.adoption.changes.length) return 0
      // A new version replaces the old file: the name carries the version, so git sees a rename with the changes.
      const target = `${DIR}/${p.upper.toLowerCase()}.v${p.adoption.version}.json`
      const others = Object.fromEntries(store.all().filter((r) => r.code !== p.upper).map((r) => [fileOf(r), JSON.parse(readFileSync(fileOf(r), 'utf8'))]))
      loadReferences({ ...others, [target]: p.adoption.ficha })
      if (p.existing) renameSync(fileOf(p.existing), target)
      writeFileSync(target, formatFicha(p.adoption.ficha))
      console.log(`${target}: written`)
      return 0
    }
    if (args.length === 1 && !args[0].startsWith('-')) {
      const r = find(args[0])
      console.log(JSON.stringify(probe(r, catalog), null, 2))
      const issues = problems(r)
      console.log(issues.length ? `✗ ${r.code}@${r.version}\n${issues.map((l) => `  ${l}`).join('\n')}` : `✓ ${r.code}@${r.version} is as its file expects`)
      return issues.length ? 1 : 0
    }
    console.error('Usage: npm run probe -- <code> | --all | --update <code> | --explain <code> [candidate.json] | --diff <code> <candidate.json> | --adopt <code> <candidate.json>')
    return 2
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    return 2
  }
}

