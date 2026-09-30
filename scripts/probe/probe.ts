import { readFileSync, writeFileSync } from 'node:fs'
import { createBundledReferences } from '../../src/adapters/references/store'
import { formatFicha } from '../../src/adapters/references/format'
import { Catalog } from '../../src/domain/materials/catalog'
import { differences, probe } from '../../src/domain/furniture/probe'
import type { Reference } from '../../src/domain/furniture/references'

// Checks a ficha against what the engine makes of it. Usage:
//   npm run probe -- kc-apa-01            one ficha, in detail
//   npm run probe -- --all                every ficha, one line each
//   npm run probe -- --update kc-apa-01   rewrite its `expect` (and only that) to what the engine makes

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
    if (args.length === 1 && !args[0].startsWith('-')) {
      const r = find(args[0])
      console.log(JSON.stringify(probe(r, catalog), null, 2))
      const issues = problems(r)
      console.log(issues.length ? `✗ ${r.code}@${r.version}\n${issues.map((l) => `  ${l}`).join('\n')}` : `✓ ${r.code}@${r.version} is as its file expects`)
      return issues.length ? 1 : 0
    }
    console.error('Usage: npm run probe -- <code> | --all | --update <code>')
    return 2
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    return 2
  }
}

